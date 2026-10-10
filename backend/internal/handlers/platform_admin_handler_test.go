package handlers

import (
	"strings"
	"testing"
)

func TestGenerateTempPassword(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 200; i++ {
		p, err := generateTempPassword(12)
		if err != nil {
			t.Fatal(err)
		}
		if len(p) != 12 {
			t.Fatalf("length %d, want 12", len(p))
		}
		for _, ch := range p {
			if !strings.ContainsRune(tempPasswordAlphabet, ch) {
				t.Fatalf("unexpected character %q in %q", ch, p)
			}
		}
		if seen[p] {
			t.Fatalf("duplicate password %q", p)
		}
		seen[p] = true
	}
}

func TestLivekitHTTPURL(t *testing.T) {
	cases := map[string]string{
		"wss://example.com/":     "https://example.com",
		"ws://localhost:7880":    "http://localhost:7880",
		"http://localhost:7880/": "http://localhost:7880",
	}
	for in, want := range cases {
		if got := livekitHTTPURL(in); got != want {
			t.Errorf("livekitHTTPURL(%q) = %q, want %q", in, got, want)
		}
	}
}
