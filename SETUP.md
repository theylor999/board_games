# Setup — Board Games Online

## 1. Criar conta no Supabase (grátis)

1. Acesse https://supabase.com e crie uma conta
2. Clique em **New Project**
3. Dê um nome, escolha senha e região (South America - São Paulo se disponível)
4. Espere o projeto criar (~1 min)

## 2. Pegar as credenciais

1. No painel do Supabase → **Settings** → **API**
2. Copie:
   - **Project URL** → será seu `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → será seu `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 3. Configurar no Vercel

1. No Vercel, vá em **Settings** → **Environment Variables**
2. Adicione as duas variáveis:
   - `NEXT_PUBLIC_SUPABASE_URL` = sua URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = sua chave anon

## 4. Habilitar Realtime no Supabase (importante!)

1. No Supabase → **Realtime** → já vem habilitado por padrão ✅

Pronto! O app usa apenas **Broadcast** do Supabase Realtime — não precisa criar tabelas.
