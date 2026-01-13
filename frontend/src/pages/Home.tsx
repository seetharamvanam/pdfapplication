import { useEffect } from 'react'
import { motion } from 'framer-motion'
import './Home.css'
import './ops.css'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { IconPdf, IconMerge, IconSplit, IconCompress, IconConvert, IconSecure } from '../components/icons' 

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
}

export default function Home() {
  useEffect(() => { }, [])

  return (
    <main className="home-page">
      <section className="hero-section">
        <div className="hero-background">
          <div className="hero-gradient-1"></div>
          <div className="hero-gradient-2"></div>
          <div className="hero-particles"></div>
        </div>
        <div className="hero-container">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="hero-content"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="hero-badge"
            >
              <span className="badge-icon">🚀</span>
              <span className="badge-text">Free Enterprise PDF Features</span>
            </motion.div>

            <h1 className="hero-title">
              Transform Your <span className="text-gradient">Documents</span> with Power
            </h1>
            <p className="hero-subtitle">
              Get enterprise PDF features for free on the web. All processing happens entirely in your browser - no data is sent to the server. Your documents never leave your device.
            </p>

            <div className="hero-stats">
              <div className="stat-item">
                <div className="stat-number">100%</div>
                <div className="stat-label">Private</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">∞</div>
                <div className="stat-label">Unlimited</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">⚡</div>
                <div className="stat-label">Lightning Fast</div>
              </div>
            </div>

            <div className="hero-actions">
              <Button
                variant="primary"
                size="lg"
                className="cta-primary"
                onClick={() => document.getElementById('hero-upload')?.click()}
              >
                <span className="btn-icon">📤</span>
                Start Processing
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="cta-secondary"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Explore Tools
                <span className="btn-arrow">→</span>
              </Button>
            </div>

            <input id="hero-upload" className="sr-only" type="file" accept="application/pdf" onChange={(e)=>{
              const file = e.target.files?.[0];
              if (file) {
                window.dispatchEvent(new CustomEvent('pdf-upload', { detail: file }))
                e.currentTarget.value = ''
              }
            }} />

            <div className="hero-features">
              <div className="feature-chip">
                <span className="chip-icon">🔒</span>
                <span>100% Private</span>
              </div>
              <div className="feature-chip">
                <span className="chip-icon">🚀</span>
                <span>No Sign-up Required</span>
              </div>
              <div className="feature-chip">
                <span className="chip-icon">⚡</span>
                <span>Lightning Fast</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1, delay: 0.4, type: "spring", bounce: 0.3 }}
            className="hero-visual"
          >
            <div className="visual-card-main">
              <div className="visual-card">
                <IconPdf className="visual-icon" />
                <div className="visual-glow"></div>
              </div>
              <div className="visual-stats">
                <div className="stat-card">
                  <div className="stat-value">10M+</div>
                  <div className="stat-desc">Documents Processed</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">4.9★</div>
                  <div className="stat-desc">User Rating</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="features" className="features-section">
        <div className="features-background">
          <div className="features-gradient"></div>
        </div>
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-header"
          >
            <div className="section-badge">
              <span className="badge-dot"></span>
              <span>Professional Tools</span>
            </div>
            <h2 className="section-title">Complete PDF <span className="text-gradient">Power Suite</span></h2>
            <p className="section-subtitle">Everything you need to manage your documents - all free, all processed in your browser, with zero server upload.</p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="features-grid"
          >
            <motion.div variants={itemVariants}>
              <Card className="feature-card feature-card-premium">
                <div className="feature-icon-wrapper">
                  <IconMerge />
                  <div className="icon-glow"></div>
                </div>
                <div className="feature-content">
                  <h3 className="feature-name">Smart Merge</h3>
                  <p className="feature-desc">Combine multiple documents into a single, polished PDF file instantly with intelligent page ordering.</p>
                  <div className="feature-meta">
                    <span className="meta-tag">Most Popular</span>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="feature-card">
                <div className="feature-icon-wrapper"><IconSplit /></div>
                <div className="feature-content">
                  <h3 className="feature-name">Precision Split</h3>
                  <p className="feature-desc">Precisely extract pages or split large documents into manageable parts with surgical accuracy.</p>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="feature-card">
                <div className="feature-icon-wrapper"><IconCompress /></div>
                <div className="feature-content">
                  <h3 className="feature-name">AI Compression</h3>
                  <p className="feature-desc">Reduce file size significantly while maintaining crystal-clear quality using advanced algorithms.</p>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="feature-card">
                <div className="feature-icon-wrapper"><IconConvert /></div>
                <div className="feature-content">
                  <h3 className="feature-name">Universal Convert</h3>
                  <p className="feature-desc">Seamlessly convert between PDF, Word, Excel, and high-resolution images with perfect formatting.</p>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="feature-card">
                <div className="feature-icon-wrapper"><IconSecure /></div>
                <div className="feature-content">
                  <h3 className="feature-name">Fort Knox Security</h3>
                  <p className="feature-desc">Military-grade encryption with local processing ensures your sensitive data never leaves your device.</p>
                </div>
              </Card>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="features-cta"
          >
            <h3>Ready to Transform Your Documents?</h3>
            <p>Join millions of users who trust our platform for their document processing needs.</p>
            <Button
              variant="primary"
              size="lg"
              className="features-cta-btn"
              onClick={() => document.getElementById('hero-upload')?.click()}
            >
              Get Started Now
              <span className="btn-arrow">→</span>
            </Button>
          </motion.div>
        </div>
      </section>

      <section className="workflow-section">
        <div className="workflow-background">
          <div className="workflow-pattern"></div>
        </div>
        <div className="workflow-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-header"
          >
            <h2 className="section-title">How It <span className="text-gradient">Works</span></h2>
            <p className="section-subtitle">Three simple steps to transform your documents</p>
          </motion.div>

          <div className="workflow-steps">
            {[
              {
                step: '01',
                title: 'Choose Your Tool',
                desc: 'Select from our comprehensive suite of professional PDF utilities tailored to your needs.',
                icon: '🎯',
                color: 'var(--color-primary-600)'
              },
              {
                step: '02',
                title: 'Upload & Process',
                desc: 'Your files are processed entirely in your browser - no data is sent to the server.',
                icon: '🔒',
                color: 'var(--color-success-500)'
              },
              {
                step: '03',
                title: 'Download Results',
                desc: 'Get your high-quality results instantly with perfect formatting preserved.',
                icon: '⚡',
                color: 'var(--color-accent-500)'
              }
            ].map((s, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.15, duration: 0.6 }}
                className="workflow-step"
              >
                <div className="step-visual">
                  <div className="step-icon" style={{ backgroundColor: s.color }}>
                    <span className="icon-emoji">{s.icon}</span>
                  </div>
                  <div className="step-connector" style={{ backgroundColor: s.color }}></div>
                </div>
                <div className="step-content">
                  <div className="step-number" style={{ color: s.color }}>{s.step}</div>
                  <h4 className="step-title">{s.title}</h4>
                  <p className="step-desc">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="workflow-demo"
          >
            <div className="demo-card">
              <div className="demo-header">
                <span className="demo-icon">🚀</span>
                <span className="demo-title">Try it now</span>
              </div>
              <p className="demo-desc">Experience the power of VeloPDF with sample documents</p>
              <Button variant="primary" className="demo-btn">
                Start Demo
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="enterprise-footer">
        <div className="footer-background">
          <div className="footer-gradient"></div>
        </div>
        <div className="footer-content">
          <div className="footer-main">
            <div className="footer-brand">
              <div className="brand-logo">
                <div className="logo-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4 4h10l6 6v10a2 2 0 0 1-2 2H4z"/>
                  </svg>
                </div>
                <div className="logo-text">
                  <span className="logo-title">VeloPDF</span>
                  <span className="logo-tagline">Free Enterprise Features</span>
                </div>
              </div>
              <p className="brand-desc">Enterprise PDF features for free on the web. Processed entirely in your browser with zero server upload - your data never leaves your device.</p>
              <div className="social-links">
                <a href="#" className="social-link" aria-label="Twitter">
                  <span>🐦</span>
                </a>
                <a href="#" className="social-link" aria-label="LinkedIn">
                  <span>💼</span>
                </a>
                <a href="#" className="social-link" aria-label="GitHub">
                  <span>⚡</span>
                </a>
              </div>
            </div>

            <div className="footer-links">
              <div className="link-group">
                <h4 className="group-title">Product</h4>
                <a href="#merge">Merge PDFs</a>
                <a href="#split">Split PDFs</a>
                <a href="#compress">Compress PDFs</a>
                <a href="#convert">Convert Files</a>
              </div>
              <div className="link-group">
                <h4 className="group-title">Company</h4>
                <a href="#">About Us</a>
                <a href="#">Careers</a>
                <a href="#">Press</a>
                <a href="#">Blog</a>
              </div>
              <div className="link-group">
                <h4 className="group-title">Support</h4>
                <a href="#">Help Center</a>
                <a href="#">Contact Us</a>
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Service</a>
              </div>
            </div>
          </div>

          <div className="footer-newsletter">
            <h4>Stay Updated</h4>
            <p>Get the latest updates on new features and improvements.</p>
            <div className="newsletter-form">
              <input type="email" placeholder="Enter your email" className="newsletter-input" />
              <Button variant="primary" className="newsletter-btn">Subscribe</Button>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-bottom-content">
            <p>&copy; {new Date().getFullYear()} VeloPDF. All rights reserved.</p>
            <div className="footer-badges">
              <span className="badge">🔒 SOC 2 Compliant</span>
              <span className="badge">🛡️ GDPR Ready</span>
              <span className="badge">⚡ 99.9% Uptime</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
