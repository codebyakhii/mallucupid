import type { VercelRequest, VercelResponse } from '@vercel/node';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { planId, userId } = req.body;
    if (!planId || !userId) {
      return res.status(400).json({ error: 'Missing planId or userId' });
    }

    // Validate user exists
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, name, email, phone')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate plan exists and is active
    const { data: plan, error: planError } = await supabase
      .from('pro_plans')
      .select('*')
      .eq('id', planId)
      .eq('active', true)
      .single();

    if (planError || !plan) {
      return res.status(404).json({ error: 'Plan not found or inactive' });
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: Math.round(plan.price * 100), // Razorpay expects paise
      currency: 'INR',
      receipt: `pro_${userId.substring(0, 8)}_${Date.now()}`,
      notes: {
        user_id: userId,
        plan_id: planId,
        plan_name: plan.name,
      },
    });

    // Record payment in DB
    const { error: insertError } = await supabase.from('payments').insert({
      user_id: userId,
      plan_id: planId,
      razorpay_order_id: order.id,
      amount: plan.price,
      currency: 'INR',
      status: 'created',
    });

    if (insertError) {
      console.error('Payment record insert error:', insertError);
      return res.status(500).json({ error: 'Failed to record payment' });
    }

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      planName: plan.label,
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phone,
    });
  } catch (err: any) {
    console.error('Create order error:', err);
    return res.status(500).json({ error: 'Failed to create order' });
  }
}
