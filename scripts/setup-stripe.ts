import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const prisma = new PrismaClient();

// Configuração dos planos
const PLANS_CONFIG = [
  {
    name: 'Free',
    description: 'Comece sua jornada espiritual',
    prices: [], // Gratuito, sem preço no Stripe
    features: [
      '1 devocional por semana',
      '5 mensagens no chat por dia',
      'Leitura guiada básica (5 livros)',
      'Perfil espiritual básico',
      'Histórico 7 dias',
    ],
    limits: {
      chatMessagesPerDay: 5,
      devotionalsPerWeek: 1,
      regenerationsPerWeek: 0,
      readingBooks: 5,
      historyDays: 7,
    },
    order: 1,
  },
  {
    name: 'Starter',
    description: 'Para quem quer consistência diária',
    prices: [
      { amount: 990, interval: 'month', nickname: 'Starter Mensal' },
      { amount: 9900, interval: 'year', nickname: 'Starter Anual (1 mês grátis)' },
    ],
    features: [
      'Devocional diário personalizado',
      '10 mensagens no chat por dia',
      'Leitura guiada completa (66 livros)',
      'Perfil espiritual completo',
      'Histórico 30 dias',
      '1 regeneração de devocional por semana',
    ],
    limits: {
      chatMessagesPerDay: 10,
      devotionalsPerDay: 1,
      regenerationsPerWeek: 1,
      readingBooks: 66,
      historyDays: 30,
    },
    order: 2,
  },
  {
    name: 'Pro',
    description: 'Experiência completa e ilimitada',
    prices: [
      { amount: 1990, interval: 'month', nickname: 'Pro Mensal' },
      { amount: 19900, interval: 'year', nickname: 'Pro Anual (2 meses grátis)' },
    ],
    features: [
      'Tudo do Starter',
      '20 mensagens no chat por dia',
      'Histórico ilimitado',
      '1 regeneração de devocional por dia',
      'Modo offline completo',
      'Exportar devocionais (PDF)',
      'Suporte por email',
    ],
    limits: {
      chatMessagesPerDay: 20,
      devotionalsPerDay: 1,
      regenerationsPerDay: 1,
      readingBooks: 66,
      historyDays: -1, // ilimitado
      exportPdf: true,
    },
    order: 3,
    popular: true,
  },
  {
    name: 'Premium',
    description: 'Para usuários power e líderes',
    prices: [
      { amount: 3990, interval: 'month', nickname: 'Premium Mensal' },
      { amount: 39900, interval: 'year', nickname: 'Premium Anual (3 meses grátis)' },
    ],
    features: [
      'Tudo do Pro',
      '50 mensagens no chat por dia',
      'Chat em tempo real (WebSocket)',
      'Devocionais temáticos ilimitados',
      'Análise de padrões espirituais (IA)',
      'Suporte prioritário',
      'Acesso antecipado a features',
    ],
    limits: {
      chatMessagesPerDay: 50,
      devotionalsPerDay: 1,
      regenerationsUnlimited: true,
      readingBooks: 66,
      historyDays: -1,
      exportPdf: true,
      websocket: true,
      aiAnalysis: true,
    },
    order: 4,
  },
  {
    name: 'Família',
    description: 'Até 4 perfis para toda a família',
    prices: [
      { amount: 4990, interval: 'month', nickname: 'Família Mensal' },
      { amount: 49900, interval: 'year', nickname: 'Família Anual (3 meses grátis)' },
    ],
    features: [
      'Tudo do Premium',
      'Até 4 perfis familiares',
      'Devocionais familiares compartilhados',
      'Chat familiar (discussões em grupo)',
      'Relatório semanal para admin',
      'Controles parentais',
    ],
    limits: {
      chatMessagesPerDay: 50,
      devotionalsPerDay: 1,
      regenerationsUnlimited: true,
      readingBooks: 66,
      historyDays: -1,
      exportPdf: true,
      websocket: true,
      aiAnalysis: true,
      maxProfiles: 4,
      familyFeatures: true,
    },
    order: 5,
  },
];

async function setupStripe() {
  console.log('🚀 Configurando Stripe com múltiplos planos...\n');

  try {
    // Criar ou obter produto principal
    let product;
    const existingProducts = await stripe.products.list({ limit: 10 });
    product = existingProducts.data.find(p => p.name === 'bible.hyno.io');

    if (!product) {
      console.log('📦 Criando produto principal...');
      product = await stripe.products.create({
        name: 'bible.hyno.io',
        description: 'Assinatura bible.hyno.io - Converse com a Bíblia via IA',
      });
      console.log(`✅ Produto criado: ${product.id}\n`);
    } else {
      console.log(`📦 Produto já existe: ${product.id}\n`);
    }

    // Processar cada plano
    for (const planConfig of PLANS_CONFIG) {
      console.log(`\n📋 Configurando plano: ${planConfig.name}`);

      // Plano Free não tem preço no Stripe
      if (planConfig.name === 'Free') {
        await savePlanToDatabase(planConfig, null, product.id);
        console.log(`✅ Plano Free configurado (sem preço no Stripe)\n`);
        continue;
      }

      // Criar preços para o plano
      for (const priceConfig of planConfig.prices) {
        const existingPrices = await stripe.prices.list({
          product: product.id,
          limit: 100,
        });

        const existingPrice = existingPrices.data.find(
          p => 
            p.unit_amount === priceConfig.amount &&
            p.recurring?.interval === priceConfig.interval &&
            p.metadata?.planName === planConfig.name
        );

        let price;
        if (!existingPrice) {
          console.log(`  💰 Criando preço ${priceConfig.interval}: R$ ${priceConfig.amount / 100}`);
          price = await stripe.prices.create({
            product: product.id,
            unit_amount: priceConfig.amount,
            currency: 'brl',
            recurring: {
              interval: priceConfig.interval as 'month' | 'year',
            },
            metadata: {
              planName: planConfig.name,
              planOrder: planConfig.order.toString(),
            },
            nickname: priceConfig.nickname,
          });
          console.log(`  ✅ Preço criado: ${price.id}`);
        } else {
          price = existingPrice;
          console.log(`  💰 Preço já existe: ${price.id}`);
        }

        // Salvar no banco de dados
        await savePlanToDatabase(planConfig, price, product.id);
      }
    }

    console.log('\n🎉 Configuração do Stripe concluída com sucesso!');
    console.log('\n📊 Resumo dos planos:');
    console.log('  • Free: R$ 0');
    console.log('  • Starter: R$ 9,90/mês ou R$ 99/ano');
    console.log('  • Pro: R$ 19,90/mês ou R$ 199/ano ⭐');
    console.log('  • Premium: R$ 39,90/mês ou R$ 399/ano');
    console.log('  • Família: R$ 49,90/mês ou R$ 499/ano');

  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function savePlanToDatabase(
  planConfig: typeof PLANS_CONFIG[0],
  stripePrice: Stripe.Price | null,
  productId: string
) {
  const planData = {
    stripePriceId: stripePrice?.id || null,
    stripeProductId: productId,
    name: planConfig.name,
    description: planConfig.description,
    amount: stripePrice?.unit_amount || 0,
    currency: 'BRL',
    interval: (stripePrice?.recurring?.interval as 'month' | 'year') || 'month',
    features: planConfig.features,
    limits: planConfig.limits,
    active: true,
    order: planConfig.order,
    popular: planConfig.popular || false,
  };

  if (stripePrice) {
    // Upsert para planos pagos
    await prisma.billingPlan.upsert({
      where: { stripePriceId: stripePrice.id },
      create: planData,
      update: planData,
    });
  } else {
    // Para plano Free, criar ou atualizar por nome
    const existing = await prisma.billingPlan.findFirst({
      where: { name: 'Free' },
    });

    if (existing) {
      await prisma.billingPlan.update({
        where: { id: existing.id },
        data: planData,
      });
    } else {
      await prisma.billingPlan.create({
        data: planData,
      });
    }
  }
}

// Executar
setupStripe();
