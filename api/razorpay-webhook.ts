import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify webhook signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers['x-razorpay-signature'] as string;
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (signature !== expectedSignature) {
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
    }

    const event = req.body.event;
    const payload = req.body.payload;

    if (event === 'payment.captured') {
      const payment = payload.payment.entity;
      const orderId = payment.order_id;

      // Check if payment already processed
      const { data: existing } = await supabase
        .from('payments')
        .select('id, status')
        .eq('razorpay_order_id', orderId)
        .single();

      if (!existing) {
        return res.status(200).json({ status: 'ok', message: 'Order not found, skipping' });
      }

      if (existing.status === 'paid') {
        return res.status(200).json({ status: 'ok', message: 'Already processed' });
      }

      // Get payment record with plan details
      const { data: paymentRecord } = await supabase
        .from('payments')
        .select('user_id, plan_id')
        .eq('razorpay_order_id', orderId)
        .single();

      if (!paymentRecord) {
        return res.status(200).json({ status: 'ok', message: 'Payment record not found' });
      }

      // Get plan duration
      const { data: plan } = await supabase
        .from('pro_plans')
        .select('duration_days')
        .eq('id', paymentRecord.plan_id)
        .single();

      if (!plan) {
        return res.status(200).json({ status: 'ok', message: 'Plan not found' });
      }

      const proExpiry = new Date(Date.now() + plan.duration_days * 24 * 60 * 60 * 1000).toISOString();

      // Update payment record
      await supabase
        .from('payments')
        .update({
          razorpay_payment_id: payment.id,
          status: 'paid',
          verified_at: new Date().toISOString(),
        })
        .eq('razorpay_order_id', orderId);

      // Activate Pro
      await supabase
        .from('profiles')
        .update({ pro_expiry: proExpiry })
        .eq('id', paymentRecord.user_id);
    }

    if (event === 'payment.failed') {
      const payment = payload.payment.entity;
      const orderId = payment.order_id;

      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('razorpay_order_id', orderId);
    }

    return res.status(200).json({ status: 'ok' });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return res.status(200).json({ status: 'ok' }); // Always return 200 to Razorpay
  }
}
