import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const checkoutSchema = z.object({
  planId: z.string(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

// Auth middleware
async function authenticate(request: any, reply: any) {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token não fornecido',
        },
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    request.user = decoded;
  } catch (err) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token inválido',
      },
    });
  }
}

export async function billingRoutes(app: FastifyInstance) {
  // Get plans (public)
  app.get('/plans', async () => {
    const plans = await app.prisma.billingPlan.findMany({
      where: { active: true },
      orderBy: { amount: 'asc' },
    });

    return {
      plans: plans.map((plan: any) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        amount: plan.amount,
        currency: plan.currency,
        interval: plan.interval,
        features: plan.features || [],
        popular: plan.interval === 'month',
        badge: plan.interval === 'year' ? 'Melhor custo-benefício' : null,
      })),
    };
  });

  // Create checkout session
  app.post('/checkout', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).user.userId;
    const body = checkoutSchema.parse(request.body);

    // Get plan
    const plan = await app.prisma.billingPlan.findUnique({
      where: { id: body.planId },
    });

    if (!plan || !plan.active) {
      return reply.status(404).send({
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Plano não encontrado',
        },
      });
    }

    // Get or create Stripe customer
    const subscription = await app.prisma.subscription.findFirst({
      where: { userId },
    });

    // Get existing customer ID or create new one
    const existingCustomerId = subscription?.stripeCustomerId;

    let customerId: string;

    if (typeof existingCustomerId === 'string') {
      // Type narrowing: sabemos que é string aqui
      customerId = existingCustomerId;
    } else {
      // Criar novo customer se não existir
      const user = await app.prisma.user.findUnique({
        where: { id: userId },
      });

      const customer = await stripe.customers.create({
        email: user!.email,
        metadata: {
          userId,
        },
      });

      customerId = customer.id;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: body.successUrl,
      cancel_url: body.cancelUrl,
      client_reference_id: userId,
      subscription_data: {
        metadata: {
          userId,
          planId: plan.id,
        },
      },
    });

    return {
      checkoutUrl: session.url,
    };
  });

  // Get subscription status
  app.get('/subscription', { preHandler: authenticate }, async (request) => {
    const userId = (request as any).user.userId;

    const subscription = await app.prisma.subscription.findFirst({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription) {
      return {
        status: 'inactive',
        plan: null,
      };
    }

    return {
      status: subscription.status,
      plan: subscription.plan ? {
        name: subscription.plan.name,
        amount: subscription.plan.amount,
        currency: subscription.plan.currency,
        interval: subscription.plan.interval,
      } : null,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    };
  });

  // Create customer portal
  app.post('/portal', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request as any).user.userId;

    const subscription = await app.prisma.subscription.findFirst({
      where: { userId },
    });

    if (!subscription?.stripeCustomerId) {
      return reply.status(404).send({
        error: {
          code: 'NO_SUBSCRIPTION',
          message: 'Nenhuma assinatura encontrada',
        },
      });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.WEB_URL}/app`,
    });

    return {
      portalUrl: portalSession.url,
    };
  });

  // Webhook handler (public)
  app.post('/webhook', async (request, reply) => {
    const payload = request.body as any;
    const sig = request.headers['stripe-signature'] as string;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        JSON.stringify(payload),
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return reply.status(400).send({
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Invalid signature',
        },
      });
    }

    // Handle events
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(app, session);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(app, invoice);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(app, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(app, subscription);
        break;
      }
    }

    return { received: true };
  });
}

async function handleCheckoutCompleted(app: FastifyInstance, session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id;
  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  if (!userId) return;

  // Get subscription details from Stripe
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = stripeSubscription.items.data[0].price.id;

  // Find plan
  const plan = await app.prisma.billingPlan.findFirst({
    where: { stripePriceId: priceId },
  });

  if (!plan) {
    console.error('Plan not found for price:', priceId);
    return;
  }

  // Create or update subscription
  await app.prisma.subscription.upsert({
    where: {
      stripeSubscriptionId: subscriptionId,
    },
    create: {
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      planId: plan.id,
      status: 'active',
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    },
    update: {
      status: 'active',
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    },
  });

  console.log(`✅ Subscription created for user ${userId}`);
}

async function handlePaymentSucceeded(app: FastifyInstance, invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) return;

  const subscription = await app.prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (!subscription) return;

  // Update period end
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
  
  await app.prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'active',
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    },
  });
}

async function handleSubscriptionUpdated(app: FastifyInstance, stripeSub: Stripe.Subscription) {
  const subscription = await app.prisma.subscription.findFirst({
    where: { stripeSubscriptionId: stripeSub.id },
  });

  if (!subscription) return;

  const status = stripeSub.status === 'active' ? 'active' :
                 stripeSub.status === 'past_due' ? 'past_due' :
                 stripeSub.cancel_at_period_end ? 'canceled' :
                 subscription.status;

  await app.prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
    },
  });
}

async function handleSubscriptionDeleted(app: FastifyInstance, stripeSub: Stripe.Subscription) {
  const subscription = await app.prisma.subscription.findFirst({
    where: { stripeSubscriptionId: stripeSub.id },
  });

  if (!subscription) return;

  await app.prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'canceled',
    },
  });
}
