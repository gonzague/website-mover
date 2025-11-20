package rclone

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/ini.v1"
)

// Remote represents an rclone remote configuration
type Remote struct {
	Name     string            `json:"name"`
	Type     string            `json:"type"` // sftp, ftp, etc.
	Host     string            `json:"host"`
	User     string            `json:"user"`
	Password string            `json:"password,omitempty"`
	Port     int               `json:"port"`
	KeyFile  string            `json:"key_file,omitempty"`
	Params   map[string]string `json:"params,omitempty"` // Additional parameters
}

// ConfigManager manages rclone configuration
type ConfigManager struct {
	configPath string
}

// NewConfigManager creates a new config manager
func NewConfigManager(configDir string) (*ConfigManager, error) {
	if configDir == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return nil, fmt.Errorf("failed to get home dir: %w", err)
		}
		configDir = filepath.Join(homeDir, ".config", "rclone")
	}

	if err := os.MkdirAll(configDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create config dir: %w", err)
	}

	configPath := filepath.Join(configDir, "rclone.conf")
	
	// Create empty config if it doesn't exist
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		if err := os.WriteFile(configPath, []byte{}, 0600); err != nil {
			return nil, fmt.Errorf("failed to create config file: %w", err)
		}
	}

	return &ConfigManager{
		configPath: configPath,
	}, nil
}

// AddRemote adds or updates a remote configuration
func (cm *ConfigManager) AddRemote(remote Remote) error {
	cfg, err := ini.Load(cm.configPath)
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	section, err := cfg.NewSection(remote.Name)
	if err != nil {
		// Section already exists, get it
		section = cfg.Section(remote.Name)
	}

	section.Key("type").SetValue(remote.Type)
	
	// Handle type-specific fields
	switch remote.Type {
	case "sftp", "ftp", "rsync":
		// These types need host, user, port
		if remote.Host != "" {
			section.Key("host").SetValue(remote.Host)
		}
		if remote.User != "" {
			section.Key("user").SetValue(remote.User)
		}
		if remote.Port > 0 {
			section.Key("port").SetValue(fmt.Sprintf("%d", remote.Port))
		}
		
		if remote.Password != "" {
			// Obscure password (rclone compatible)
			obscured, err := obscurePassword(remote.Password)
			if err != nil {
				return fmt.Errorf("failed to obscure password: %w", err)
			}
			section.Key("pass").SetValue(obscured)
		}
		
		if remote.KeyFile != "" {
			section.Key("key_file").SetValue(remote.KeyFile)
		}
	case "s3":
		// S3-specific fields - don't set host/user/port
		// Provider, region, endpoint, etc. will be in Params
	default:
		// For other types, set host/user/port if provided
		if remote.Host != "" {
			section.Key("host").SetValue(remote.Host)
		}
		if remote.User != "" {
			section.Key("user").SetValue(remote.User)
		}
		if remote.Port > 0 {
			section.Key("port").SetValue(fmt.Sprintf("%d", remote.Port))
		}
	}

	// Add any additional parameters
	for key, value := range remote.Params {
		if value != "" {
			// Handle password/secret obscuring
			if key == "secret_access_key" || key == "pass" {
				obscured, err := obscurePassword(value)
				if err != nil {
					return fmt.Errorf("failed to obscure %s: %w", key, err)
				}
				section.Key(key).SetValue(obscured)
			} else {
				section.Key(key).SetValue(value)
			}
		}
	}

	if err := cfg.SaveTo(cm.configPath); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	return nil
}

// GetRemote retrieves a remote configuration
func (cm *ConfigManager) GetRemote(name string) (*Remote, error) {
	cfg, err := ini.Load(cm.configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	section := cfg.Section(name)
	if section == nil {
		return nil, fmt.Errorf("remote %s not found", name)
	}

	remote := &Remote{
		Name:   name,
		Type:   section.Key("type").String(),
		Host:   section.Key("host").String(),
		User:   section.Key("user").String(),
		Port:   section.Key("port").MustInt(22),
		Params: make(map[string]string),
	}

	if section.HasKey("key_file") {
		remote.KeyFile = section.Key("key_file").String()
	}

	// Read additional params (for S3, etc.)
	// Skip standard fields we already have
	skipKeys := map[string]bool{
		"type": true, "host": true, "user": true, "port": true,
		"pass": true, "key_file": true, "password": true,
	}
	
	for _, key := range section.Keys() {
		keyName := key.Name()
		if !skipKeys[keyName] {
			remote.Params[keyName] = key.String()
		}
	}
	
	// Note: We don't return passwords/secrets for security
	
	return remote, nil
}

// ListRemotes lists all configured remotes
func (cm *ConfigManager) ListRemotes() ([]Remote, error) {
	cfg, err := ini.Load(cm.configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	var remotes []Remote
	for _, section := range cfg.Sections() {
		if section.Name() == "DEFAULT" {
			continue
		}

		remote := Remote{
			Name:   section.Name(),
			Type:   section.Key("type").String(),
			Host:   section.Key("host").String(),
			User:   section.Key("user").String(),
			Port:   section.Key("port").MustInt(22),
			Params: make(map[string]string),
		}

		if section.HasKey("key_file") {
			remote.KeyFile = section.Key("key_file").String()
		}

		// Read additional params (for S3, etc.)
		skipKeys := map[string]bool{
			"type": true, "host": true, "user": true, "port": true,
			"pass": true, "key_file": true, "password": true, "secret_access_key": true,
		}
		
		for _, key := range section.Keys() {
			keyName := key.Name()
			if !skipKeys[keyName] {
				remote.Params[keyName] = key.String()
			}
		}

		remotes = append(remotes, remote)
	}

	return remotes, nil
}

// DeleteRemote removes a remote configuration
func (cm *ConfigManager) DeleteRemote(name string) error {
	cfg, err := ini.Load(cm.configPath)
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	cfg.DeleteSection(name)

	if err := cfg.SaveTo(cm.configPath); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	return nil
}

// GetConfigPath returns the path to the rclone config file
func (cm *ConfigManager) GetConfigPath() string {
	return cm.configPath
}

