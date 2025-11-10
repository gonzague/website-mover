package probe

import "fmt"

// Probe tests a connection based on the protocol and returns detailed information
func Probe(config ConnectionConfig) (*ProbeResult, error) {
	switch config.Protocol {
	case ProtocolSFTP:
		return ProbeSFTP(config)
	case ProtocolFTP, ProtocolFTPS:
		return ProbeFTP(config)
	case ProtocolSCP:
		// SCP uses SSH, so we can reuse SFTP logic
		return ProbeSFTP(config)
	default:
		return nil, fmt.Errorf("unsupported protocol: %s", config.Protocol)
	}
}
