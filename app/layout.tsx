import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { VoiceProvider } from '@/lib/hume/voice-provider'
import { ErrorBoundary } from '@/components/error-boundary'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

export const metadata: Metadata = {
  title: 'Aura Mirror - Magical Emotion Reflection',
  description: 'An interactive mirror that reveals your emotional aura through AI-powered emotion detection',
  generator: 'Next.js',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://aura-mirror.vercel.app',
    title: 'Aura Mirror - Magical Emotion Reflection',
    description: 'An interactive mirror that reveals your emotional aura through AI-powered emotion detection',
    siteName: 'Aura Mirror',
  },
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <style>{`
          html {
            font-family: ${GeistSans.style.fontFamily};
            --font-sans: ${GeistSans.variable};
            --font-mono: ${GeistMono.variable};
          }
          
          /* Full screen styles for kiosk mode */
          body {
            overflow: hidden;
            position: fixed;
            width: 100%;
            height: 100%;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
          }
          
          /* Disable pull-to-refresh on mobile */
          body {
            overscroll-behavior-y: none;
          }
          
          /* Hide scrollbars */
          ::-webkit-scrollbar {
            display: none;
          }
          
          * {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          
          /* Particle animation */
          @keyframes particle-float {
            0%, 100% {
              transform: translateY(0) translateX(0) scale(1);
              opacity: 0.6;
            }
            25% {
              transform: translateY(-20px) translateX(10px) scale(1.1);
              opacity: 0.8;
            }
            50% {
              transform: translateY(-10px) translateX(-10px) scale(0.9);
              opacity: 0.7;
            }
            75% {
              transform: translateY(-30px) translateX(5px) scale(1.05);
              opacity: 0.5;
            }
          }
          
          .particle-float {
            animation: particle-float 6s ease-in-out infinite;
          }
          
          /* Aura glow animation */
          @keyframes pulse-aura {
            0%, 100% {
              opacity: 0.4;
              transform: scale(1);
            }
            50% {
              opacity: 0.6;
              transform: scale(1.05);
            }
          }
          
          .aura-glow {
            animation: pulse-aura 3s ease-in-out infinite;
          }
          
          /* Magical gradient background */
          .magical-gradient {
            background: linear-gradient(
              135deg,
              rgba(139, 92, 246, 0.3) 0%,
              rgba(236, 72, 153, 0.3) 25%,
              rgba(251, 191, 36, 0.3) 50%,
              rgba(16, 185, 129, 0.3) 75%,
              rgba(59, 130, 246, 0.3) 100%
            );
            backdrop-filter: blur(10px);
          }
          
          /* Mirror frame effect */
          .mirror-frame {
            position: relative;
            background: linear-gradient(145deg, #1a1a1a, #2d2d2d);
            box-shadow: 
              20px 20px 60px #0d0d0d,
              -20px -20px 60px #333333,
              inset 0 0 20px rgba(255, 255, 255, 0.1);
          }
          
          .mirror-frame::before {
            content: '';
            position: absolute;
            inset: -2px;
            background: linear-gradient(
              45deg,
              #fbbf24,
              #f97316,
              #ec4899,
              #8b5cf6,
              #3b82f6,
              #06b6d4,
              #10b981,
              #fbbf24
            );
            border-radius: inherit;
            z-index: -1;
            opacity: 0.5;
            animation: rotate-gradient 4s linear infinite;
          }
          
          @keyframes rotate-gradient {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
        `}</style>
        
        {/* Meta tags for full-screen kiosk mode */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
        
        {/* Prevent zooming on mobile */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body className="font-sans antialiased">
        <ErrorBoundary>
          <VoiceProvider>
            {children}
          </VoiceProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
