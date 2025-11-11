package scanner

import (
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/gonzague/website-mover/backend/internal/probe"
)

// GeneratePlan creates a complete migration plan
func GeneratePlan(scanResult *ScanResult, sourceProbe *probe.ProbeResult, destProbe *probe.ProbeResult, sourceConfig *probe.ConnectionConfig, destConfig *probe.ConnectionConfig) *PlanResult {
	if scanResult == nil || sourceProbe == nil || destProbe == nil {
		return &PlanResult{
			Success:      false,
			ErrorMessage: "Missing required data for plan generation",
		}
	}

	// Calculate all possible strategies
	strategies := calculateStrategies(scanResult, sourceProbe, destProbe, sourceConfig, destConfig)

	// Find recommended strategy
	var recommended *TransferStrategy
	highestScore := 0.0
	for i := range strategies {
		if strategies[i].Score > highestScore {
			highestScore = strategies[i].Score
			recommended = &strategies[i]
		}
	}

	if recommended != nil {
		recommended.IsRecommended = true
	}

	// Generate warnings
	warnings := generateWarnings(scanResult, sourceProbe, destProbe)

	// Calculate total estimated time
	totalTime := recommended.EstimatedTime
	if scanResult.CMSDetection != nil && scanResult.CMSDetection.Detected {
		// Add database export/import time estimate
		totalTime += estimateDatabaseTime(scanResult.Statistics.TotalSize)
	}

	return &PlanResult{
		Success:             true,
		ScanResult:          scanResult,
		SourceProbe:         sourceProbe,
		DestProbe:           destProbe,
		Strategies:          strategies,
		RecommendedStrategy: recommended,
		Warnings:            warnings,
		RequiresDatabase:    scanResult.CMSDetection != nil && scanResult.CMSDetection.Detected,
		EstimatedTotalTime:  totalTime,
	}
}

// calculateStrategies scores all possible transfer methods
func calculateStrategies(scan *ScanResult, source *probe.ProbeResult, dest *probe.ProbeResult, sourceConfig *probe.ConnectionConfig, destConfig *probe.ConnectionConfig) []TransferStrategy {
	var strategies []TransferStrategy

	stats := scan.Statistics
	// Calculate actual transferable size (excluding excluded files)
	transferableSize := stats.TotalSize - stats.ExcludedSize
	_ = stats.TotalFiles // fileCount not currently used but may be needed later

	// 1. FXP (FTP server-to-server)
	if canUseFXP(source, dest) {
		strategy := TransferStrategy{
			Method:            MethodFXP,
			Score:             scoreFXP(source, dest, stats),
			EstimatedTime:     estimateTransferTime(transferableSize, 10*1024*1024), // 10 MB/s typical
			Command:           generateFXPCommand(sourceConfig, destConfig, source, dest),
			CommandExplanation: "Direct server-to-server FTP transfer (fastest)",
			Pros: []string{
				"Fastest method (server-to-server)",
				"No bandwidth consumed on client",
				"Supports resume",
			},
			Cons: []string{
				"Requires FXP support on both servers",
				"May be blocked by firewalls",
			},
			Requirements:      []string{"FTP/FTPS on both servers", "FXP enabled"},
			CanResume:         true,
			SupportsProgress:  false,
		}
		strategy.EstimatedTimeStr = strategy.EstimatedTime.String()
		strategies = append(strategies, strategy)
	}

	// 2. rsync over SSH
	if canUseRsync(source, dest) {
		strategy := TransferStrategy{
			Method:            MethodRsyncSSH,
			Score:             scoreRsync(source, dest, stats),
			EstimatedTime:     estimateTransferTime(transferableSize, float64(source.Performance.UploadSpeed)*1024*1024),
			Command:           generateRsyncCommand(sourceConfig, destConfig, source, dest),
			CommandExplanation: "Incremental sync with compression",
			Pros: []string{
				"Very efficient (only transfers changes)",
				"Excellent for updates/resumes",
				"Compression support",
				"Preserves permissions and timestamps",
			},
			Cons: []string{
				"Requires rsync installed on both servers",
				"SSH access needed",
			},
			Requirements:      []string{"SSH access", "rsync on both servers"},
			CanResume:         true,
			SupportsProgress:  true,
		}
		strategy.EstimatedTimeStr = strategy.EstimatedTime.String()
		strategies = append(strategies, strategy)
	}

	// 3. SFTP streaming
	if source.Protocol == probe.ProtocolSFTP && dest.Protocol == probe.ProtocolSFTP {
		avgSpeed := (source.Performance.DownloadSpeed + dest.Performance.UploadSpeed) / 2
		strategy := TransferStrategy{
			Method:            MethodSFTPStream,
			Score:             scoreSFTPStream(source, dest, stats),
			EstimatedTime:     estimateTransferTime(transferableSize, avgSpeed*1024*1024),
			Command:           "Custom SFTP streaming implementation",
			CommandExplanation: "Direct SFTP file-by-file transfer",
			Pros: []string{
				"Works with SFTP-only servers",
				"Good compatibility",
				"Supports resume",
			},
			Cons: []string{
				"Slower than server-to-server methods",
				"Consumes client bandwidth",
				"Less efficient for many small files",
			},
			Requirements:      []string{"SFTP on both servers"},
			CanResume:         true,
			SupportsProgress:  true,
		}
		strategy.EstimatedTimeStr = strategy.EstimatedTime.String()
		strategies = append(strategies, strategy)
	}

	// 4. lftp mirror
	if canUseLFTP(source, dest) {
		avgSpeed := (source.Performance.DownloadSpeed + dest.Performance.UploadSpeed) / 2
		strategy := TransferStrategy{
			Method:            MethodLFTP,
			Score:             scoreLFTP(source, dest, stats),
			EstimatedTime:     estimateTransferTime(transferableSize, avgSpeed*1024*1024),
			Command:           generateLFTPCommand(sourceConfig, destConfig, source, dest),
			CommandExplanation: "Mirror with lftp (supports FTP/SFTP)",
			Pros: []string{
				"Excellent for FTP/FTPS",
				"Parallel transfers",
				"Robust resume support",
				"Good for many small files",
			},
			Cons: []string{
				"Requires lftp on client",
				"Consumes client bandwidth",
			},
			Requirements:      []string{"lftp installed on client"},
			CanResume:         true,
			SupportsProgress:  true,
		}
		strategy.EstimatedTimeStr = strategy.EstimatedTime.String()
		strategies = append(strategies, strategy)
	}

	// 5. tar + SSH pipe
	if canUseTarStream(source, dest) {
		strategy := TransferStrategy{
			Method:            MethodTarStream,
			Score:             scoreTarStream(source, dest, stats),
			EstimatedTime:     estimateTransferTime(transferableSize, float64(source.Performance.UploadSpeed)*1024*1024*1.5), // Compression helps
			Command:           generateTarStreamCommand(sourceConfig, destConfig, source, dest),
			CommandExplanation: "Streaming tar archive over SSH",
			Pros: []string{
				"Very fast for many small files",
				"Excellent compression",
				"Preserves all attributes",
				"Single stream (less overhead)",
			},
			Cons: []string{
				"No resume support",
				"Requires shell access on both servers",
				"All-or-nothing transfer",
			},
			Requirements:      []string{"SSH shell access on both servers", "tar and gzip"},
			CanResume:         false,
			SupportsProgress:  false,
		}
		strategy.EstimatedTimeStr = strategy.EstimatedTime.String()
		strategies = append(strategies, strategy)
	}

	// Sort by score descending using Go's efficient sort
	sort.Slice(strategies, func(i, j int) bool {
		return strategies[i].Score > strategies[j].Score
	})

	return strategies
}

// Capability checks
func canUseFXP(source, dest *probe.ProbeResult) bool {
	return source.Capabilities.FXPAllowed && dest.Capabilities.FXPAllowed &&
		(source.Protocol == probe.ProtocolFTP || source.Protocol == probe.ProtocolFTPS) &&
		(dest.Protocol == probe.ProtocolFTP || dest.Protocol == probe.ProtocolFTPS)
}

func canUseRsync(source, dest *probe.ProbeResult) bool {
	return source.Capabilities.ShellAvailable && dest.Capabilities.ShellAvailable &&
		source.Protocol == probe.ProtocolSFTP && dest.Protocol == probe.ProtocolSFTP
}

func canUseLFTP(source, dest *probe.ProbeResult) bool {
	return true // lftp works with FTP, FTPS, and SFTP
}

func canUseTarStream(source, dest *probe.ProbeResult) bool {
	return source.Capabilities.ShellAvailable && dest.Capabilities.ShellAvailable &&
		source.Protocol == probe.ProtocolSFTP && dest.Protocol == probe.ProtocolSFTP
}

// Scoring functions (0-100)
func scoreFXP(source, dest *probe.ProbeResult, stats FileStatistics) float64 {
	score := 90.0 // Base score - FXP is excellent when available

	// Penalty for many small files (FXP has overhead per file)
	if stats.TotalFiles > 10000 {
		score -= 10.0
	}

	// Bonus for good network performance
	avgLatency := (source.Performance.LatencyMs + dest.Performance.LatencyMs) / 2
	if avgLatency < 50 {
		score += 5.0
	}

	return math.Min(score, 100.0)
}

func scoreRsync(source, dest *probe.ProbeResult, stats FileStatistics) float64 {
	score := 85.0 // Excellent general-purpose tool

	// Bonus for many files (rsync excels here)
	if stats.TotalFiles > 5000 {
		score += 10.0
	}

	// Bonus for compression support
	if len(source.Capabilities.CompressionTypes) > 0 {
		score += 5.0
	}

	return math.Min(score, 100.0)
}

func scoreSFTPStream(source, dest *probe.ProbeResult, stats FileStatistics) float64 {
	score := 70.0 // Good fallback

	// Penalty for many files
	if stats.TotalFiles > 10000 {
		score -= 15.0
	}

	// Penalty for large total size
	if stats.TotalSize > 10*1024*1024*1024 { // > 10GB
		score -= 10.0
	}

	avgSpeed := (source.Performance.UploadSpeed + dest.Performance.DownloadSpeed) / 2
	if avgSpeed > 5.0 { // > 5 MB/s
		score += 10.0
	}

	return math.Max(score, 40.0)
}

func scoreLFTP(source, dest *probe.ProbeResult, stats FileStatistics) float64 {
	score := 75.0

	// Bonus for FTP/FTPS (lftp's specialty)
	if source.Protocol == probe.ProtocolFTP || source.Protocol == probe.ProtocolFTPS {
		score += 10.0
	}

	// Bonus for many files (parallel transfers help)
	if stats.TotalFiles > 1000 {
		score += 5.0
	}

	return math.Min(score, 100.0)
}

func scoreTarStream(source, dest *probe.ProbeResult, stats FileStatistics) float64 {
	score := 80.0

	// Big bonus for many small files
	avgFileSize := float64(stats.TotalSize) / float64(stats.TotalFiles)
	if avgFileSize < 100*1024 && stats.TotalFiles > 5000 { // < 100KB average, many files
		score += 15.0
	}

	// Penalty for very large total size (can't resume)
	if stats.TotalSize > 50*1024*1024*1024 { // > 50GB
		score -= 20.0
	}

	return math.Max(score, 50.0)
}

// Time estimation
func estimateTransferTime(bytes int64, speedMBps float64) time.Duration {
	if speedMBps <= 0 {
		speedMBps = 1.0 // Default to 1 MB/s
	}

	seconds := float64(bytes) / (speedMBps * 1024 * 1024)
	// Add 20% overhead for protocol, retries, etc.
	seconds *= 1.2

	return time.Duration(seconds) * time.Second
}

func estimateDatabaseTime(websiteSize int64) time.Duration {
	// Rough estimate: database is usually 5-10% of website size
	// Dump/import is typically slower than file transfer
	dbSize := float64(websiteSize) * 0.07
	seconds := dbSize / (2 * 1024 * 1024) // 2 MB/s for database operations
	return time.Duration(seconds) * time.Second
}

// Command generation
func generateFXPCommand(sourceConfig, destConfig *probe.ConnectionConfig, source, dest *probe.ProbeResult) string {
	return fmt.Sprintf("lftp -c 'open %s@%s; mirror --use-fxp %s %s://%s@%s:%s'",
		sourceConfig.Username, sourceConfig.Host, sourceConfig.RootPath,
		destConfig.Protocol, destConfig.Username, destConfig.Host, destConfig.RootPath)
}

func generateRsyncCommand(sourceConfig, destConfig *probe.ConnectionConfig, source, dest *probe.ProbeResult) string {
	return fmt.Sprintf("rsync -avz --progress -e ssh %s@%s:%s/ %s@%s:%s/",
		sourceConfig.Username, sourceConfig.Host, sourceConfig.RootPath,
		destConfig.Username, destConfig.Host, destConfig.RootPath)
}

func generateLFTPCommand(sourceConfig, destConfig *probe.ConnectionConfig, source, dest *probe.ProbeResult) string {
	return fmt.Sprintf("lftp -c 'open %s://%s@%s; mirror --parallel=4 --verbose %s %s://%s@%s:%s'",
		sourceConfig.Protocol, sourceConfig.Username, sourceConfig.Host, sourceConfig.RootPath,
		destConfig.Protocol, destConfig.Username, destConfig.Host, destConfig.RootPath)
}

func generateTarStreamCommand(sourceConfig, destConfig *probe.ConnectionConfig, source, dest *probe.ProbeResult) string {
	return fmt.Sprintf("ssh %s@%s 'cd %s && tar czf - .' | ssh %s@%s 'cd %s && tar xzf -'",
		sourceConfig.Username, sourceConfig.Host, sourceConfig.RootPath,
		destConfig.Username, destConfig.Host, destConfig.RootPath)
}

// generateWarnings creates warnings based on scan and probe results
func generateWarnings(scan *ScanResult, source, dest *probe.ProbeResult) []string {
	var warnings []string

	// Large number of files
	if scan.Statistics.TotalFiles > 50000 {
		warnings = append(warnings, fmt.Sprintf("Large number of files (%d) may slow down transfer", scan.Statistics.TotalFiles))
	}

	// Large total size
	if scan.Statistics.TotalSize > 100*1024*1024*1024 { // > 100GB
		warnings = append(warnings, fmt.Sprintf("Large total size (%s) will take significant time", scan.Statistics.TotalSizeHuman))
	}

	// Write permission check
	if !dest.Capabilities.CanWrite {
		warnings = append(warnings, "Destination server may not have write permissions")
	}

	// Disk space (we don't know dest free space, but warn if close)
	if scan.Statistics.TotalSize > 10*1024*1024*1024 {
		warnings = append(warnings, "Ensure destination has sufficient disk space")
	}

	// Excluded files
	if scan.Statistics.ExcludedCount > 0 {
		warnings = append(warnings, fmt.Sprintf("%d files will be excluded (%s)",
			scan.Statistics.ExcludedCount, formatBytes(scan.Statistics.ExcludedSize)))
	}

	// Database migration
	if scan.CMSDetection != nil && scan.CMSDetection.Detected {
		if scan.CMSDetection.DatabaseConfig == nil {
			warnings = append(warnings, "Database credentials not found - manual migration may be required")
		} else {
			warnings = append(warnings, "Database migration required after file transfer")
		}
	}

	// Performance warnings
	avgLatency := (source.Performance.LatencyMs + dest.Performance.LatencyMs) / 2
	if avgLatency > 200 {
		warnings = append(warnings, fmt.Sprintf("High latency (%.0f ms) may slow down transfer", avgLatency))
	}

	return warnings
}
