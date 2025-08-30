import { NextRequest, NextResponse } from 'next/server'
import { getHumeAccessToken } from '@/lib/hume/config'

// API route for server-side Hume operations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body

    switch (action) {
      case 'refresh-token':
        return handleTokenRefresh()
      
      case 'create-session':
        return handleCreateSession(data)
      
      case 'end-session':
        return handleEndSession(data)
      
      case 'analyze-emotion':
        return handleEmotionAnalysis(data)
      
      case 'get-config':
        return handleGetConfig()
      
      case 'get-api-key':
        return handleGetApiKey()
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Hume API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle token refresh
async function handleTokenRefresh() {
  try {
    const token = await getHumeAccessToken()
    
    if (!token) {
      return NextResponse.json(
        { error: 'Failed to get access token' },
        { status: 401 }
      )
    }

    // Return token with expiry (tokens are valid for 1 hour)
    return NextResponse.json({
      token,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
    })
  } catch (error) {
    console.error('Token refresh error:', error)
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 }
    )
  }
}

// Create a new EVI session
async function handleCreateSession(data: any) {
  try {
    const token = await getHumeAccessToken()
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }

    const response = await fetch('https://api.hume.ai/v0/evi/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Hume-Api-Key': process.env.HUME_API_KEY || ''
      },
      body: JSON.stringify({
        config_id: process.env.HUME_CONFIG_ID || data.configId,
        ...data
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Session creation failed:', error)
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: response.status }
      )
    }

    const session = await response.json()
    return NextResponse.json(session)
  } catch (error) {
    console.error('Session creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}

// End an EVI session
async function handleEndSession(data: any) {
  try {
    const token = await getHumeAccessToken()
    
    if (!token || !data.sessionId) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      )
    }

    const response = await fetch(`https://api.hume.ai/v0/evi/chat/${data.sessionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Hume-Api-Key': process.env.HUME_API_KEY || ''
      }
    })

    if (!response.ok) {
      console.error('Session end failed:', response.statusText)
      return NextResponse.json(
        { error: 'Failed to end session' },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Session end error:', error)
    return NextResponse.json(
      { error: 'Failed to end session' },
      { status: 500 }
    )
  }
}

// Analyze emotions from various inputs
async function handleEmotionAnalysis(data: any) {
  try {
    const token = await getHumeAccessToken()
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }

    let endpoint = ''
    let requestBody: any = {}

    // Determine the appropriate endpoint based on input type
    if (data.type === 'facial') {
      endpoint = 'https://api.hume.ai/v0/batch/jobs'
      requestBody = {
        models: {
          face: {
            fps_pred: 3,
            prob_threshold: 0.1,
            identify_faces: false,
            min_face_size: 60
          }
        },
        urls: data.urls || [],
        files: data.files || []
      }
    } else if (data.type === 'prosody') {
      endpoint = 'https://api.hume.ai/v0/batch/jobs'
      requestBody = {
        models: {
          prosody: {
            granularity: 'utterance',
            identify_speakers: false
          }
        },
        urls: data.urls || [],
        files: data.files || []
      }
    } else if (data.type === 'language') {
      endpoint = 'https://api.hume.ai/v0/batch/jobs'
      requestBody = {
        models: {
          language: {
            granularity: 'sentence',
            identify_speakers: false
          }
        },
        text: data.text || []
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid analysis type' },
        { status: 400 }
      )
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Hume-Api-Key': process.env.HUME_API_KEY || ''
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Emotion analysis failed:', error)
      return NextResponse.json(
        { error: 'Failed to analyze emotions' },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Emotion analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze emotions' },
      { status: 500 }
    )
  }
}

// Get Hume configuration
async function handleGetConfig() {
  try {
    const token = await getHumeAccessToken()
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }

    const configId = process.env.HUME_CONFIG_ID
    
    if (!configId) {
      // Return default config if no specific config ID is set
      return NextResponse.json({
        id: 'default',
        name: 'Aura Mirror Configuration',
        description: 'Configuration for the Aura Mirror application',
        voice: {
          provider: 'hume',
          voice_id: 'kora',
          language: 'en-US'
        },
        language_model: {
          model_provider: 'anthropic',
          model_resource: 'claude-3-5-sonnet-20241022',
          temperature: 0.7
        },
        tools: [],
        builtin_tools: [],
        event_messages: {
          on_session_start: "Mirror mirror on the wall, I sense your presence. How may I reflect your inner light today?",
          on_session_end: "Until we meet again, may your aura shine bright.",
          on_user_interruption: "I'm listening...",
          on_user_silence: "Take your time, I can feel your contemplation..."
        }
      })
    }

    // Fetch specific config from Hume
    const response = await fetch(`https://api.hume.ai/v0/evi/configs/${configId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Hume-Api-Key': process.env.HUME_API_KEY || ''
      }
    })

    if (!response.ok) {
      console.error('Config fetch failed:', response.statusText)
      return NextResponse.json(
        { error: 'Failed to fetch configuration' },
        { status: response.status }
      )
    }

    const config = await response.json()
    return NextResponse.json(config)
  } catch (error) {
    console.error('Config fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch configuration' },
      { status: 500 }
    )
  }
}

// Get API key for client-side WebSocket connections
async function handleGetApiKey() {
  try {
    const apiKey = process.env.HUME_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      apiKey
    });
  } catch (error) {
    console.error('API key fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API key' },
      { status: 500 }
    );
  }
}

// GET endpoint for health check
export async function GET() {
  try {
    // Check if we can get a token
    const token = await getHumeAccessToken()
    
    if (!token) {
      return NextResponse.json({
        status: 'error',
        message: 'Unable to authenticate with Hume API',
        timestamp: new Date().toISOString()
      }, { status: 503 })
    }

    return NextResponse.json({
      status: 'healthy',
      message: 'Hume API connection is active',
      timestamp: new Date().toISOString(),
      config: {
        hasApiKey: !!process.env.HUME_API_KEY,
        hasSecretKey: !!process.env.HUME_SECRET_KEY,
        hasConfigId: !!process.env.HUME_CONFIG_ID
      }
    })
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    }, { status: 503 })
  }
}