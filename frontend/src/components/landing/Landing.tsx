import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import { MicIcon, MapPinIcon, RouteIcon, ChannelIcon, GroupIcon, ChevronRightIcon, PhoneIcon, LockIcon } from '../icons/Icons';

const Landing: React.FC = () => {
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = heroRef.current;
    if (!root) return;
    const frame = requestAnimationFrame(() => root.classList.add('is-ready'));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="tl-landing">
      <Navbar />

      <section className="tl-hero" ref={heroRef} aria-label="FarePro">
        <div className="tl-hero-atmosphere" aria-hidden="true">
          <div className="tl-hero-grid" />
          <div className="tl-hero-glow tl-hero-glow-a" />
          <div className="tl-hero-glow tl-hero-glow-b" />
          <div className="tl-hero-product">
            <div className="tl-hero-product-shell">
              <div className="tl-hero-product-rail">
                <span className="tl-hero-dot" />
                <span className="tl-hero-dot" />
                <span className="tl-hero-dot active" />
                <span className="tl-hero-dot" />
              </div>
              <div className="tl-hero-product-main">
                <div className="tl-hero-product-header">
                  <span className="tl-hero-product-avatar">D</span>
                  <div>
                    <strong>Dispatch</strong>
                    <em>12 kilo drivers online</em>
                  </div>
                </div>
                <div className="tl-hero-product-wave" />
                <div className="tl-hero-product-ptt">Hold to talk</div>
              </div>
            </div>
          </div>
        </div>

        <div className="tl-hero-content">
          <p className="tl-hero-brand">FarePro</p>
          <h1>The radio your kilo taxi stand actually needs</h1>
          <p className="tl-hero-lead">
            Instant push-to-talk, live driver map, and encrypted calls — built for founders, owners, and drivers who live on the road.
          </p>
          <div className="tl-hero-actions">
            <Link to="/org/signup" className="tl-btn tl-btn-primary">
              Create your stand
              <ChevronRightIcon size={18} />
            </Link>
            <Link to="/login" className="tl-btn tl-btn-ghost">
              Driver sign in
            </Link>
          </div>
        </div>
      </section>

      <section className="tl-section tl-capabilities" aria-labelledby="capabilities-title">
        <div className="tl-section-inner">
          <header className="tl-section-head">
            <h2 id="capabilities-title">Made for kilo taxi operations</h2>
            <p>Owners run the stand. Drivers stay on channel. Dispatch hears everyone — without WhatsApp chaos.</p>
          </header>

          <ul className="tl-capability-list">
            <li>
              <MicIcon size={24} />
              <div>
                <h3>Stand push-to-talk</h3>
                <p>Hold to talk to dispatch or the whole stand. No dialing mid-fare.</p>
              </div>
            </li>
            <li>
              <MapPinIcon size={24} />
              <div>
                <h3>Live driver map</h3>
                <p>See who is free, busy, or offline — so owners can fill the next job faster.</p>
              </div>
            </li>
            <li>
              <RouteIcon size={24} />
              <div>
                <h3>Trip &amp; route history</h3>
                <p>Replay trails for disputes, fuel checks, and shift reviews.</p>
              </div>
            </li>
            <li>
              <ChannelIcon size={24} />
              <div>
                <h3>Dispatch channels</h3>
                <p>Separate Dispatch, On Duty, Jobs, and Emergency — keep noise out of the radio.</p>
              </div>
            </li>
            <li>
              <GroupIcon size={24} />
              <div>
                <h3>Owner &amp; driver roles</h3>
                <p>Founders control the stand. Drivers join with a phone number and stay in sync.</p>
              </div>
            </li>
            <li>
              <LockIcon size={24} />
              <div>
                <h3>Encrypted stand calls</h3>
                <p>Private voice when you need it — without leaking fares on public chat apps.</p>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <section className="tl-section tl-proof" aria-labelledby="proof-title">
        <div className="tl-section-inner tl-proof-inner">
          <header className="tl-section-head">
            <h2 id="proof-title">One stand. One radio. Every driver.</h2>
            <p>Replace handheld clutter and scattered chats with a workspace your whole kilo fleet can run on.</p>
          </header>
          <div className="tl-proof-strip">
            <div>
              <PhoneIcon size={22} />
              <span>Calls &amp; PTT</span>
            </div>
            <div>
              <ChannelIcon size={22} />
              <span>Channels</span>
            </div>
            <div>
              <MapPinIcon size={22} />
              <span>Tracking</span>
            </div>
          </div>
        </div>
      </section>

      <section className="tl-section tl-closing" aria-labelledby="closing-title">
        <div className="tl-section-inner tl-closing-inner">
          <h2 id="closing-title">Ready for your next rush hour</h2>
          <p>Set up your stand free. Invite drivers when you’re ready.</p>
          <Link to="/org/signup" className="tl-btn tl-btn-primary">
            Launch your stand
            <ChevronRightIcon size={18} />
          </Link>
        </div>
      </section>

      <footer className="tl-footer">
        <div className="tl-footer-inner">
          <div className="tl-footer-brand">
            <span className="tl-footer-mark" aria-hidden="true">FP</span>
            <span>FarePro</span>
          </div>
          <nav className="tl-footer-links" aria-label="Footer">
            <Link to="/industries">Industries</Link>
            <Link to="/resources">Resources</Link>
            <Link to="/enterprise">Enterprise</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/contact">Contact</Link>
          </nav>
          <p className="tl-footer-copy">© 2026 FarePro. Built for kilo taxi stands.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
