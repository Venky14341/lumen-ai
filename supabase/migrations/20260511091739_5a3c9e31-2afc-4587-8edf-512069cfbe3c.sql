
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_user ON public.conversations(user_id, updated_at DESC);
CREATE INDEX idx_messages_conv ON public.messages(conversation_id, created_at);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_conv_select" ON public.conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_conv_insert" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_conv_update" ON public.conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_conv_delete" ON public.conversations FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "own_msg_select" ON public.messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_msg_insert" ON public.messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_msg_delete" ON public.messages FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_conversation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_touch_conv AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.touch_conversation();
