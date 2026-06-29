/* ============================================================
   SPARK — налаштування хмарної бази (Supabase)
   ------------------------------------------------------------
   Встав сюди два значення зі свого проєкту Supabase:
   Project Settings → API → Project URL та anon public key.
   Доки тут стоять заглушки «ВСТАВ_...», сайт працює без
   збереження прогресу (читати уроки можна, входу немає).
   ============================================================ */
window.SPARK_CONFIG = {
  SUPABASE_URL:      "https://bimbdxhicylmfzhcjtmg.supabase.co",          // напр. https://abcdefgh.supabase.co
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpbWJkeGhpY3lsbWZ6aGNqdG1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3Mzk4NzAsImV4cCI6MjA5ODMxNTg3MH0.cQQd9igWjUgjvmMutp9kAinq71-x75mra0V0g_6za8Q",     // рядок, що починається з eyJ...
  TABLE: "spark_progress"                          // назва таблиці (НЕ змінюй без потреби)
};
