package push

import (
	"encoding/json"
	"log"

	webpush "github.com/SherClockHolmes/webpush-go"
)

type Subscription struct {
	Endpoint string `json:"endpoint" db:"endpoint"`
	P256DH   string `json:"p256dh"  db:"p256dh"`
	Auth     string `json:"auth"    db:"auth"`
}

type Payload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	Icon  string `json:"icon"`
	Tag   string `json:"tag"`
	URL   string `json:"url"`
}

type Service struct {
	vapidPublic  string
	vapidPrivate string
	subject      string
}

func NewService(publicKey, privateKey, subject string) *Service {
	return &Service{
		vapidPublic:  publicKey,
		vapidPrivate: privateKey,
		subject:      subject,
	}
}

func (s *Service) Send(sub Subscription, p Payload) {
	if s.vapidPublic == "" || s.vapidPrivate == "" {
		return
	}
	body, err := json.Marshal(p)
	if err != nil {
		return
	}
	wSub := &webpush.Subscription{
		Endpoint: sub.Endpoint,
		Keys: webpush.Keys{
			P256dh: sub.P256DH,
			Auth:   sub.Auth,
		},
	}
	resp, err := webpush.SendNotification(body, wSub, &webpush.Options{
		Subscriber:      s.subject,
		VAPIDPublicKey:  s.vapidPublic,
		VAPIDPrivateKey: s.vapidPrivate,
		TTL:             60,
	})
	if err != nil {
		log.Printf("push send error: %v", err)
		return
	}
	defer resp.Body.Close()
}

func (s *Service) SendToMany(subs []Subscription, p Payload) {
	for _, sub := range subs {
		go s.Send(sub, p)
	}
}
