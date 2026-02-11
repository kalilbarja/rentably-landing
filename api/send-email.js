// Vercel Serverless Function: /api/send-email.js
// SECURITY: API keys stored in environment variables

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "Rentably <noreply@rentably.io>";

// Security: Sanitize HTML to prevent XSS attacks
function sanitizeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Security: Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Security: Rate limiting (basic in-memory, resets on cold start)
const rateLimits = new Map();
const RATE_LIMIT_MAX = 100; // max emails per hour per IP
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimits.get(ip);
  
  if (!record || now - record.start > RATE_LIMIT_WINDOW) {
    rateLimits.set(ip, { count: 1, start: now });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  record.count++;
  return true;
}

export default async function handler(req, res) {
  // Security: Restrict CORS to known domains
  const allowedOrigins = [
    'https://rentably.io',
    'https://www.rentably.io',
    'http://localhost:3000'
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Security: Check rate limit
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  // Security: Validate API key is configured
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  try {
    const payload = req.body;

    // Security: Validate required fields exist
    if (!payload || !payload.type || !payload.to) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Security: Validate email format
    if (!isValidEmail(payload.to)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Security: Validate email type
    const validTypes = ['new_request', 'request_scheduled', 'request_completed'];
    if (!validTypes.includes(payload.type)) {
      return res.status(400).json({ error: 'Invalid email type' });
    }

    // Security: Sanitize all user inputs
    const safe = {
      residentName: sanitizeHtml(payload.residentName),
      propertyName: sanitizeHtml(payload.propertyName),
      unitNumber: sanitizeHtml(payload.unitNumber),
      category: sanitizeHtml(payload.category),
      description: sanitizeHtml(payload.description),
      scheduledDate: sanitizeHtml(payload.scheduledDate),
    };
    
    let subject = '';
    let html = '';
    
    if (payload.type === 'new_request') {
      subject = `Nueva Solicitud de Mantenimiento - ${safe.propertyName} ${safe.unitNumber}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🔧 Nueva Solicitud de Mantenimiento</h1>
          </div>
          <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="margin: 0 0 15px;"><strong>Residente:</strong> ${safe.residentName}</p>
            <p style="margin: 0 0 15px;"><strong>Propiedad:</strong> ${safe.propertyName} - ${safe.unitNumber}</p>
            <p style="margin: 0 0 15px;"><strong>Categoría:</strong> ${safe.category}</p>
            <p style="margin: 0 0 15px;"><strong>Descripción:</strong></p>
            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
              ${safe.description}
            </div>
            <div style="margin-top: 20px;">
              <a href="https://rentably.io/admin" style="background: #4F46E5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">
                Ver en Dashboard
              </a>
            </div>
          </div>
        </div>
      `;
    } else if (payload.type === 'request_scheduled') {
      subject = `Tu solicitud ha sido programada - ${safe.scheduledDate}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📅 Visita Programada</h1>
          </div>
          <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="margin: 0 0 15px;">Hola ${safe.residentName},</p>
            <p style="margin: 0 0 15px;">Tu solicitud de mantenimiento ha sido programada para:</p>
            <div style="background: #4F46E5; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <div style="font-size: 24px; font-weight: bold;">${safe.scheduledDate}</div>
            </div>
            <p style="margin: 0 0 15px;"><strong>Categoría:</strong> ${safe.category}</p>
            <p style="margin: 0 0 15px;"><strong>Propiedad:</strong> ${safe.propertyName} - ${safe.unitNumber}</p>
            <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px;">
              Por favor asegúrate de estar disponible en el horario indicado. Si necesitas reprogramar, contacta a administración.
            </p>
          </div>
        </div>
      `;
    } else if (payload.type === 'request_completed') {
      subject = `Tu solicitud ha sido completada`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">✅ Solicitud Completada</h1>
          </div>
          <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="margin: 0 0 15px;">Hola ${safe.residentName},</p>
            <p style="margin: 0 0 15px;">Tu solicitud de mantenimiento ha sido completada.</p>
            <p style="margin: 0 0 15px;"><strong>Categoría:</strong> ${safe.category}</p>
            <p style="margin: 0 0 15px;"><strong>Propiedad:</strong> ${safe.propertyName} - ${safe.unitNumber}</p>
            <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px;">
              Si tienes algún problema o la reparación no fue satisfactoria, por favor crea una nueva solicitud en el portal.
            </p>
            <div style="margin-top: 20px;">
              <a href="https://rentably.io/portal" style="background: #10B981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">
                Ver en Portal
              </a>
            </div>
          </div>
        </div>
      `;
    }

    // Send email via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: payload.to,
        subject: subject,
        html: html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send email');
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    // Security: Don't expose internal error details to client
    console.error('Email error:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
