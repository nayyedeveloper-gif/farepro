package transcription

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func TranscribeAudio(apiKey, filePath string) (string, error) {
	if apiKey == "" {
		return "", fmt.Errorf("OPENAI_API_KEY not configured")
	}

	f, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("open audio file: %w", err)
	}
	defer f.Close()

	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	if err := w.WriteField("model", "whisper-1"); err != nil {
		return "", err
	}
	part, err := w.CreateFormFile("file", filepath.Base(filePath))
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(part, f); err != nil {
		return "", err
	}
	if err := w.Close(); err != nil {
		return "", err
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.openai.com/v1/audio/transcriptions", &body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", w.FormDataContentType())

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("whisper API %d: %s", resp.StatusCode, string(respBody))
	}

	// Response is JSON: {"text":"..."}
	text := extractJSONField(string(respBody), "text")
	if text == "" {
		return "", fmt.Errorf("empty transcription")
	}
	return text, nil
}

func extractJSONField(raw, key string) string {
	marker := `"` + key + `":`
	i := strings.Index(raw, marker)
	if i == -1 {
		return ""
	}
	rest := raw[i+len(marker):]
	rest = strings.TrimSpace(rest)
	if !strings.HasPrefix(rest, `"`) {
		return ""
	}
	rest = rest[1:]
	end := strings.Index(rest, `"`)
	if end == -1 {
		return ""
	}
	return rest[:end]
}
