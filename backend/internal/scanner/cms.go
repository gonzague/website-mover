package scanner

import (
	"fmt"
	"io"
	"path"
	"regexp"
	"strings"
)

// detectCMS analyzes files to detect CMS type
func (s *Scanner) detectCMS(files []FileEntry) *CMSDetection {
	// Try detecting each CMS type
	detectors := []func([]FileEntry) *CMSDetection{
		s.detectWordPress,
		s.detectPrestaShop,
		s.detectDrupal,
		s.detectJoomla,
		s.detectMagento,
	}

	for _, detector := range detectors {
		if detection := detector(files); detection != nil && detection.Detected {
			return detection
		}
	}

	return &CMSDetection{
		Detected:   false,
		Type:       CMSUnknown,
		Confidence: 0.0,
	}
}

// detectWordPress detects WordPress installation
func (s *Scanner) detectWordPress(files []FileEntry) *CMSDetection {
	indicators := []string{}
	confidence := 0.0
	var configPath string
	var rootPath string

	// Check for WordPress indicators
	for _, file := range files {
		name := strings.ToLower(file.Name)
		filePath := strings.ToLower(file.Path)

		// Strong indicators
		if name == "wp-config.php" {
			indicators = append(indicators, "wp-config.php")
			confidence += 40.0
			configPath = file.Path
			rootPath = path.Dir(file.Path)
		}
		if strings.Contains(filePath, "wp-content") && file.IsDir {
			indicators = append(indicators, "wp-content/")
			confidence += 20.0
		}
		if strings.Contains(filePath, "wp-includes") && file.IsDir {
			indicators = append(indicators, "wp-includes/")
			confidence += 20.0
		}
		if strings.Contains(filePath, "wp-admin") && file.IsDir {
			indicators = append(indicators, "wp-admin/")
			confidence += 10.0
		}
		if name == "wp-load.php" {
			indicators = append(indicators, "wp-load.php")
			confidence += 5.0
		}
		if name == "wp-settings.php" {
			indicators = append(indicators, "wp-settings.php")
			confidence += 5.0
		}
	}

	if confidence < 50.0 {
		return nil
	}

	detection := &CMSDetection{
		Detected:   true,
		Type:       CMSWordPress,
		RootPath:   rootPath,
		ConfigFile: configPath,
		Confidence: confidence / 100.0,
		Indicators: indicators,
	}

	// Parse wp-config.php for database credentials
	if configPath != "" {
		if dbConfig := s.parseWordPressConfig(configPath); dbConfig != nil {
			detection.DatabaseConfig = dbConfig
		}
	}

	// Try to detect version
	if version := s.detectWordPressVersion(files, rootPath); version != "" {
		detection.Version = version
	}

	return detection
}

// detectPrestaShop detects PrestaShop installation
func (s *Scanner) detectPrestaShop(files []FileEntry) *CMSDetection {
	indicators := []string{}
	confidence := 0.0
	var configPath string
	var rootPath string

	for _, file := range files {
		name := strings.ToLower(file.Name)
		filePath := strings.ToLower(file.Path)

		if strings.Contains(filePath, "config/settings.inc.php") {
			indicators = append(indicators, "config/settings.inc.php")
			confidence += 50.0
			configPath = file.Path
			rootPath = path.Dir(path.Dir(file.Path))
		}
		if strings.Contains(filePath, "/classes/") && file.IsDir {
			indicators = append(indicators, "classes/")
			confidence += 15.0
		}
		if strings.Contains(filePath, "/modules/") && file.IsDir {
			indicators = append(indicators, "modules/")
			confidence += 15.0
		}
		if name == "index.php" && strings.Contains(filePath, "prestashop") {
			indicators = append(indicators, "PrestaShop references")
			confidence += 10.0
		}
	}

	if confidence < 50.0 {
		return nil
	}

	detection := &CMSDetection{
		Detected:   true,
		Type:       CMSPrestaShop,
		RootPath:   rootPath,
		ConfigFile: configPath,
		Confidence: confidence / 100.0,
		Indicators: indicators,
	}

	// Parse config for database credentials
	if configPath != "" {
		if dbConfig := s.parsePrestaShopConfig(configPath); dbConfig != nil {
			detection.DatabaseConfig = dbConfig
		}
	}

	return detection
}

// detectDrupal detects Drupal installation
func (s *Scanner) detectDrupal(files []FileEntry) *CMSDetection {
	indicators := []string{}
	confidence := 0.0
	var configPath string
	var rootPath string

	for _, file := range files {
		name := strings.ToLower(file.Name)
		filePath := strings.ToLower(file.Path)

		if strings.Contains(filePath, "sites/default/settings.php") {
			indicators = append(indicators, "sites/default/settings.php")
			confidence += 50.0
			configPath = file.Path
			// Root is 2 levels up from sites/default
			rootPath = path.Dir(path.Dir(path.Dir(file.Path)))
		}
		if strings.Contains(filePath, "/core/") && file.IsDir {
			indicators = append(indicators, "core/")
			confidence += 20.0
		}
		if strings.Contains(filePath, "/modules/") && file.IsDir {
			indicators = append(indicators, "modules/")
			confidence += 15.0
		}
		if name == "index.php" && strings.Contains(filePath, "drupal") {
			indicators = append(indicators, "Drupal references")
			confidence += 10.0
		}
	}

	if confidence < 50.0 {
		return nil
	}

	detection := &CMSDetection{
		Detected:   true,
		Type:       CMSDrupal,
		RootPath:   rootPath,
		ConfigFile: configPath,
		Confidence: confidence / 100.0,
		Indicators: indicators,
	}

	// Parse settings.php for database credentials
	if configPath != "" {
		if dbConfig := s.parseDrupalConfig(configPath); dbConfig != nil {
			detection.DatabaseConfig = dbConfig
		}
	}

	return detection
}

// detectJoomla detects Joomla installation
func (s *Scanner) detectJoomla(files []FileEntry) *CMSDetection {
	indicators := []string{}
	confidence := 0.0
	var configPath string
	var rootPath string

	for _, file := range files {
		name := strings.ToLower(file.Name)
		filePath := strings.ToLower(file.Path)

		if name == "configuration.php" {
			indicators = append(indicators, "configuration.php")
			confidence += 40.0
			configPath = file.Path
			rootPath = path.Dir(file.Path)
		}
		if strings.Contains(filePath, "/administrator/") && file.IsDir {
			indicators = append(indicators, "administrator/")
			confidence += 20.0
		}
		if strings.Contains(filePath, "/components/") && file.IsDir {
			indicators = append(indicators, "components/")
			confidence += 15.0
		}
		if strings.Contains(filePath, "/libraries/") && file.IsDir {
			indicators = append(indicators, "libraries/")
			confidence += 15.0
		}
	}

	if confidence < 50.0 {
		return nil
	}

	return &CMSDetection{
		Detected:   true,
		Type:       CMSJoomla,
		RootPath:   rootPath,
		ConfigFile: configPath,
		Confidence: confidence / 100.0,
		Indicators: indicators,
	}
}

// detectMagento detects Magento installation
func (s *Scanner) detectMagento(files []FileEntry) *CMSDetection {
	indicators := []string{}
	confidence := 0.0
	var rootPath string

	for _, file := range files {
		name := strings.ToLower(file.Name)
		filePath := strings.ToLower(file.Path)

		if strings.Contains(filePath, "app/etc/local.xml") {
			indicators = append(indicators, "app/etc/local.xml")
			confidence += 50.0
			rootPath = path.Dir(path.Dir(path.Dir(file.Path)))
		}
		if strings.Contains(filePath, "/app/code/") && file.IsDir {
			indicators = append(indicators, "app/code/")
			confidence += 20.0
		}
		if name == "mage" {
			indicators = append(indicators, "mage script")
			confidence += 15.0
		}
	}

	if confidence < 50.0 {
		return nil
	}

	return &CMSDetection{
		Detected:   true,
		Type:       CMSMagento,
		RootPath:   rootPath,
		Confidence: confidence / 100.0,
		Indicators: indicators,
	}
}

// parseWordPressConfig extracts database config from wp-config.php
func (s *Scanner) parseWordPressConfig(configPath string) *DatabaseConfig {
	content, err := s.readFile(configPath)
	if err != nil {
		return nil
	}

	config := &DatabaseConfig{Port: 3306}

	// Parse database constants
	patterns := map[string]*string{
		`define\s*\(\s*['"]DB_NAME['"],\s*['"]([^'"]+)['"]`:     &config.Database,
		`define\s*\(\s*['"]DB_USER['"],\s*['"]([^'"]+)['"]`:     &config.Username,
		`define\s*\(\s*['"]DB_PASSWORD['"],\s*['"]([^'"]+)['"]`: &config.Password,
		`define\s*\(\s*['"]DB_HOST['"],\s*['"]([^'"]+)['"]`:     &config.Host,
		`\$table_prefix\s*=\s*['"]([^'"]+)['"]`:                 &config.Prefix,
	}

	for pattern, target := range patterns {
		re := regexp.MustCompile(pattern)
		if matches := re.FindStringSubmatch(content); len(matches) > 1 {
			*target = matches[1]
		}
	}

	// Parse host:port if specified
	if strings.Contains(config.Host, ":") {
		parts := strings.Split(config.Host, ":")
		config.Host = parts[0]
		fmt.Sscanf(parts[1], "%d", &config.Port)
	}

	if config.Database == "" || config.Username == "" {
		return nil
	}

	return config
}

// parsePrestaShopConfig extracts database config from PrestaShop settings
func (s *Scanner) parsePrestaShopConfig(configPath string) *DatabaseConfig {
	content, err := s.readFile(configPath)
	if err != nil {
		return nil
	}

	config := &DatabaseConfig{Port: 3306}

	patterns := map[string]*string{
		`define\s*\(\s*'_DB_SERVER_',\s*'([^']+)'\)`:   &config.Host,
		`define\s*\(\s*'_DB_NAME_',\s*'([^']+)'\)`:     &config.Database,
		`define\s*\(\s*'_DB_USER_',\s*'([^']+)'\)`:     &config.Username,
		`define\s*\(\s*'_DB_PASSWD_',\s*'([^']+)'\)`:   &config.Password,
		`define\s*\(\s*'_DB_PREFIX_',\s*'([^']+)'\)`:   &config.Prefix,
	}

	for pattern, target := range patterns {
		re := regexp.MustCompile(pattern)
		if matches := re.FindStringSubmatch(content); len(matches) > 1 {
			*target = matches[1]
		}
	}

	if config.Database == "" || config.Username == "" {
		return nil
	}

	return config
}

// parseDrupalConfig extracts database config from Drupal settings.php
func (s *Scanner) parseDrupalConfig(configPath string) *DatabaseConfig {
	content, err := s.readFile(configPath)
	if err != nil {
		return nil
	}

	config := &DatabaseConfig{Port: 3306}

	// Drupal 7/8/9 uses $databases array
	re := regexp.MustCompile(`\$databases\s*\[['"]default['"]\]\[['"]default['"]\]\s*=\s*array\s*\((.*?)\);`)
	if matches := re.FindStringSubmatch(content); len(matches) > 1 {
		dbArray := matches[1]

		// Parse array elements
		patterns := map[string]*string{
			`['"]database['"]\s*=>\s*['"]([^'"]+)['"]`: &config.Database,
			`['"]username['"]\s*=>\s*['"]([^'"]+)['"]`: &config.Username,
			`['"]password['"]\s*=>\s*['"]([^'"]+)['"]`: &config.Password,
			`['"]host['"]\s*=>\s*['"]([^'"]+)['"]`:     &config.Host,
			`['"]prefix['"]\s*=>\s*['"]([^'"]+)['"]`:   &config.Prefix,
		}

		for pattern, target := range patterns {
			re := regexp.MustCompile(pattern)
			if matches := re.FindStringSubmatch(dbArray); len(matches) > 1 {
				*target = matches[1]
			}
		}
	}

	if config.Database == "" || config.Username == "" {
		return nil
	}

	return config
}

// detectWordPressVersion tries to detect WordPress version
func (s *Scanner) detectWordPressVersion(files []FileEntry, rootPath string) string {
	// Look for version.php
	versionPath := path.Join(rootPath, "wp-includes", "version.php")
	content, err := s.readFile(versionPath)
	if err != nil {
		return ""
	}

	// Parse $wp_version
	re := regexp.MustCompile(`\$wp_version\s*=\s*['"]([^'"]+)['"]`)
	if matches := re.FindStringSubmatch(content); len(matches) > 1 {
		return matches[1]
	}

	return ""
}

// readFile reads a file from SFTP
func (s *Scanner) readFile(filePath string) (string, error) {
	file, err := s.sftpClient.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		return "", err
	}

	return string(content), nil
}
