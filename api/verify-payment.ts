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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, planId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !userId || !planId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify Razorpay signature (HMAC SHA256)
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      // Mark payment as failed
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('razorpay_order_id', razorpay_order_id);

      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Get plan details for duration
    const { data: plan, error: planError } = await supabase
      .from('pro_plans')
      .select('duration_days')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Calculate pro expiry
    const proExpiry = new Date(Date.now() + plan.duration_days * 24 * 60 * 60 * 1000).toISOString();

    // Update payment record
    const { error: paymentError } = await supabase
      .from('payments')
      .update({
        razorpay_payment_id,
        razorpay_signature,
        status: 'paid',
        verified_at: new Date().toISOString(),
      })
      .eq('razorpay_order_id', razorpay_order_id);

    if (paymentError) {
      console.error('Payment update error:', paymentError);
      return res.status(500).json({ error: 'Failed to update payment record' });
    }

    // Activate Pro on user profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ pro_expiry: proExpiry })
      .eq('id', userId);

    if (profileError) {
      console.error('Profile update error:', profileError);
      return res.status(500).json({ error: 'Payment verified but failed to activate Pro. Contact support.' });
    }

    return res.status(200).json({
      success: true,
      proExpiry: new Date(proExpiry).getTime(),
    });
  } catch (err: any) {
    console.error('Verify payment error:', err);
    return res.status(500).json({ error: 'Payment verification failed' });
  }
}
