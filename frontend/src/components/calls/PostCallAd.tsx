import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi';

interface Ad {
  id: string;
  title: string;
  description: string;
  type: 'image' | 'video' | 'html';
  contentUrl: string;
  targetUrl: string;
  duration: number;
}

interface PostCallAdProps {
  onSkip: () => void;
  onAdClick: (adId: string, targetUrl: string) => void;
}

const PostCallAd: React.FC<PostCallAdProps> = ({ onSkip, onAdClick }) => {
  const [ad, setAd] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const [impressionTracked, setImpressionTracked] = useState(false);

  useEffect(() => {
    loadActiveAd();
  }, []);

  useEffect(() => {
    if (ad && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            onSkip();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [ad, timeLeft, onSkip]);

  useEffect(() => {
    if (ad && !impressionTracked) {
      adminApi.trackAdImpression(ad.id);
      setImpressionTracked(true);
    }
  }, [ad, impressionTracked]);

  useEffect(() => {
    if (ad && timeLeft > 0) {
      const skipTimer = setTimeout(() => {
        setCanSkip(true);
      }, 3000); // Allow skip after 3 seconds

      return () => clearTimeout(skipTimer);
    }
  }, [ad, timeLeft]);

  const loadActiveAd = async () => {
    try {
      const data = await adminApi.getActiveAds();
      if (data.ads && data.ads.length > 0) {
        const randomAd = data.ads[Math.floor(Math.random() * data.ads.length)];
        setAd(randomAd);
        setTimeLeft(randomAd.duration);
      } else {
        // No active ads, skip immediately
        onSkip();
      }
    } catch (error) {
      console.error('Failed to load ad:', error);
      onSkip();
    } finally {
      setLoading(false);
    }
  };

  const handleAdClick = () => {
    if (ad) {
      adminApi.trackAdClick(ad.id);
      onAdClick(ad.id, ad.targetUrl);
    }
  };

  const handleSkip = () => {
    if (canSkip) {
      onSkip();
    }
  };

  if (loading) {
    return (
      <div className="post-call-ad loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!ad) {
    return null;
  }

  const renderAdContent = () => {
    switch (ad.type) {
      case 'image':
        return (
          <img
            src={ad.contentUrl}
            alt={ad.title}
            className="ad-image"
            onClick={handleAdClick}
          />
        );
      case 'video':
        return (
          <video
            src={ad.contentUrl}
            className="ad-video"
            autoPlay
            muted
            playsInline
            onClick={handleAdClick}
          />
        );
      case 'html':
        return (
          <div
            className="ad-html"
            dangerouslySetInnerHTML={{ __html: ad.contentUrl }}
            onClick={handleAdClick}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="post-call-ad">
      <div className="ad-container">
        <div className="ad-content">
          {renderAdContent()}
        </div>
        <div className="ad-overlay">
          <div className="ad-info">
            <div className="ad-title">{ad.title}</div>
            {ad.description && <div className="ad-description">{ad.description}</div>}
          </div>
          <div className="ad-timer">
            <span className="timer-text">Skip in {timeLeft}s</span>
            <button
              className={`skip-button ${canSkip ? 'enabled' : 'disabled'}`}
              onClick={handleSkip}
              disabled={!canSkip}
            >
              Skip Ad
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostCallAd;
