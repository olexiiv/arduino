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
  SUPABASE_ANON_KEY: "sb_publishable_DzGhI1et1LolxP9SISaKSw_jT6HSUhR",     // рядок, що починається з eyJ...
  TABLE: "spark_progress"                          // назва таблиці (НЕ змінюй без потреби)
};
