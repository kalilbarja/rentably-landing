// Vercel Serverless Function: /api/send-email.js

const RESEND_API_KEY = "re_6MZRjmmU_HtUjrzAa2t3PyKxzDZvir8Ff";
const FROM_EMAIL = "Rentably <noreply@rentably.io>";

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;
    
    let subject = '';
    let html = '';
    
    if (payload.type === 'new_request') {
      // Email to admin about new request
      subject = `Nueva Solicitud de Mantenimiento - ${payload.propertyName} ${payload.unitNumber}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🔧 Nueva Solicitud de Mantenimiento</h1>
          </div>
          <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="margin: 0 0 15px;"><strong>Residente:</strong> ${payload.residentName}</p>
            <p style="margin: 0 0 15px;"><strong>Propiedad:</strong> ${payload.propertyName} - ${payload.unitNumber}</p>
            <p style="margin: 0 0 15px;"><strong>Categoría:</strong> ${payload.category}</p>
            <p style="margin: 0 0 15px;"><strong>Descripción:</strong></p>
            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
              ${payload.description}
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
      // Email to resident about scheduled date
      subject = `Tu solicitud ha sido programada - ${payload.scheduledDate}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📅 Visita Programada</h1>
          </div>
          <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="margin: 0 0 15px;">Hola ${payload.residentName},</p>
            <p style="margin: 0 0 15px;">Tu solicitud de mantenimiento ha sido programada para:</p>
            <div style="background: #4F46E5; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <div style="font-size: 24px; font-weight: bold;">${payload.scheduledDate}</div>
            </div>
            <p style="margin: 0 0 15px;"><strong>Categoría:</strong> ${payload.category}</p>
            <p style="margin: 0 0 15px;"><strong>Propiedad:</strong> ${payload.propertyName} - ${payload.unitNumber}</p>
            <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px;">
              Por favor asegúrate de estar disponible en el horario indicado. Si necesitas reprogramar, contacta a administración.
            </p>
          </div>
        </div>
      `;
    } else if (payload.type === 'request_completed') {
      // Email to resident about completion
      subject = `Tu solicitud ha sido completada`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">✅ Solicitud Completada</h1>
          </div>
          <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="margin: 0 0 15px;">Hola ${payload.residentName},</p>
            <p style="margin: 0 0 15px;">Tu solicitud de mantenimiento ha sido completada.</p>
            <p style="margin: 0 0 15px;"><strong>Categoría:</strong> ${payload.category}</p>
            <p style="margin: 0 0 15px;"><strong>Propiedad:</strong> ${payload.propertyName} - ${payload.unitNumber}</p>
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

    return res.status(200).json({ success: true, data });

  } catch (error) {
    console.error('Email error:', error);
    return res.status(500).json({ error: error.message });
  }
}
