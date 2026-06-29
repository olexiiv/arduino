/* ============================================================
   SPARK — налаштування хмарної бази (Supabase)
   ------------------------------------------------------------
   Встав сюди два значення зі свого проєкту Supabase:
   Project Settings → API → Project URL та anon public key.
   Доки тут стоять заглушки «ВСТАВ_...», сайт працює без
   збереження прогресу (читати уроки можна, входу немає).

   anon-ключ можна безпечно публікувати в коді — доступ до
   даних захищає RLS (Row Level Security) у самій базі.
   ============================================================ */
window.SPARK_CONFIG = {
  SUPABASE_URL:      "https://bimbdxhicylmfzhcjtmg.supabase.co",          // напр. https://abcdefgh.supabase.co
  SUPABASE_ANON_KEY: "sb_publishable_DzGhI1et1LolxP9SISaKSw_jT6HSUhR",     // довгий рядок, що починається з eyJ...
  TABLE: "progress"                                // назва таблиці прогресу
};
