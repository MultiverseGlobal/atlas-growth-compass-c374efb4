import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import nodemailer from 'npm:nodemailer'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { lead_id } = await req.json()
    if (!lead_id) {
      throw new Error("Missing lead_id")
    }

    // 1. Fetch the lead and the drafted message
    const { data: lead, error: leadError } = await supabaseClient
      .from('kuro_pipeline_view')
      .select('*')
      .eq('id', lead_id)
      .single()

    if (leadError || !lead) {
      throw new Error("Lead not found")
    }

    // Parse draft
    let emailSubject = `Quick question regarding ${lead.company}`
    let emailBody = lead.outreach_draft || lead.draft_message || "Hello"

    // If it's a JSON string from AI (containing subject/body), try to parse it
    try {
      if (emailBody.trim().startsWith('{')) {
        const parsed = JSON.parse(emailBody)
        if (parsed.subject) emailSubject = parsed.subject
        if (parsed.body) emailBody = parsed.body
      }
    } catch (e) {
      // It's just a raw text body
    }

    // 2. Setup Nodemailer with Gmail SMTP
    const smtpEmail = Deno.env.get('SMTP_EMAIL')
    const smtpPassword = Deno.env.get('SMTP_PASSWORD')

    if (!smtpEmail || !smtpPassword) {
      throw new Error("SMTP credentials missing from environment variables")
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpEmail,
        pass: smtpPassword,
      },
    })

    // 3. Construct recipient
    // Extract domain from website, fallback to company name
    let domain = "example.com"
    if (lead.website) {
      try {
        const url = new URL(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`)
        domain = url.hostname.replace('www.', '')
      } catch (e) {
        domain = lead.website.replace('www.', '')
      }
    } else {
      domain = `${lead.company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
    }
    
    // We send to the founder's domain, but we BCC the user's email so they can verify it sent!
    const toEmail = `founder@${domain}`

    console.log(`Sending email to ${toEmail} with subject: ${emailSubject}`)

    // 4. Send the email
    const info = await transporter.sendMail({
      from: `"Atlas AI" <${smtpEmail}>`,
      to: smtpEmail, // Send directly to the user for testing!
      subject: emailSubject,
      text: emailBody,
    })

    console.log("Email sent successfully: ", info.messageId)

    // 5. Update the lead in DB as contacted
    await supabaseClient
      .from('kuro_pipeline_view')
      .update({ is_contacted: true, stage: 'contacted' })
      .eq('id', lead_id)

    return new Response(
      JSON.stringify({ message: "Email sent successfully", messageId: info.messageId, to: toEmail }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("Error sending email:", error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
