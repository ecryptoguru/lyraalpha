DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'SupportMessage'
  ) THEN
    ALTER TABLE "SupportMessage" REPLICA IDENTITY FULL;
    ALTER TABLE "SupportMessage" ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'SupportMessage'
        AND policyname = 'allow_realtime_read'
    ) THEN
      CREATE POLICY "allow_realtime_read" ON "SupportMessage"
        FOR SELECT USING (true);
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'SupportConversation'
  ) THEN
    ALTER TABLE "SupportConversation" REPLICA IDENTITY FULL;

    IF EXISTS (
      SELECT 1
      FROM pg_publication
      WHERE pubname = 'supabase_realtime'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE "SupportConversation";
    END IF;
  END IF;
END $$;
