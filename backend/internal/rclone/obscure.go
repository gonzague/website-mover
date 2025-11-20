package rclone

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
)

// This is rclone's built-in obscure key
// It's not meant to be secure encryption, just obscuration
var obscureKey = []byte{
	0x9c, 0x93, 0x5b, 0x48, 0x73, 0x0a, 0x55, 0x4d,
	0x6b, 0xfd, 0x7c, 0x63, 0xc8, 0x86, 0xa9, 0x2b,
	0xd3, 0x90, 0x19, 0x8e, 0xb8, 0x12, 0x8a, 0xfb,
	0xf4, 0xde, 0x16, 0x2b, 0x8b, 0x95, 0xf6, 0x38,
}

// obscurePassword obscures a password in a way compatible with rclone
func obscurePassword(password string) (string, error) {
	if password == "" {
		return "", nil
	}

	block, err := aes.NewCipher(obscureKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(password), nil)
	return base64.RawURLEncoding.EncodeToString(ciphertext), nil
}

// revealPassword reveals an obscured password (for testing/debugging)
func revealPassword(obscured string) (string, error) {
	if obscured == "" {
		return "", nil
	}

	ciphertext, err := base64.RawURLEncoding.DecodeString(obscured)
	if err != nil {
		return "", fmt.Errorf("failed to decode: %w", err)
	}

	block, err := aes.NewCipher(obscureKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

