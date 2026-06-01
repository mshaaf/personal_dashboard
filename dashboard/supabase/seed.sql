-- ============================================
-- SEED: Default PPL exercises (global, user_id = null)
-- Run AFTER schema.sql
-- ============================================

insert into exercises (name, category, equipment, primary_muscles, secondary_muscles, source, is_favorite) values
-- PUSH
('Bench Press', 'strength', 'barbell', array['chest'], array['triceps','front_delts'], 'custom', true),
('Incline Dumbbell Press', 'strength', 'dumbbell', array['chest','upper_chest'], array['triceps','front_delts'], 'custom', true),
('Weighted Dips', 'strength', 'body_weight', array['chest','triceps'], array['front_delts'], 'custom', true),
('Overhead Shoulder Press', 'strength', 'barbell', array['front_delts'], array['triceps','traps'], 'custom', true),
('Cable Lateral Raise', 'strength', 'cable', array['lateral_delts'], array['traps'], 'custom', true),
('Cable Overhead Tricep Extension', 'strength', 'cable', array['triceps'], array[]::text[], 'custom', true),
('Tricep Rope Pushdown', 'strength', 'cable', array['triceps'], array[]::text[], 'custom', true),
-- PULL
('Pull-Ups', 'strength', 'body_weight', array['lats'], array['biceps','rhomboids'], 'custom', true),
('Lat Pulldown', 'strength', 'cable', array['lats'], array['biceps','rhomboids'], 'custom', true),
('Dumbbell Row', 'strength', 'dumbbell', array['lats','rhomboids'], array['biceps','rear_delts'], 'custom', true),
('Archer Rear Delt Cable', 'strength', 'cable', array['rear_delts'], array['rhomboids'], 'custom', true),
('Cable Hammer Curl', 'strength', 'cable', array['biceps','brachialis'], array[]::text[], 'custom', true),
('Reverse Barbell Curl', 'strength', 'barbell', array['brachialis','forearms'], array['biceps'], 'custom', true),
('Dumbbell Kelso Shrug', 'strength', 'dumbbell', array['traps'], array['rear_delts'], 'custom', true),
-- LEGS
('Dumbbell Split Squat', 'strength', 'dumbbell', array['quads','glutes'], array['hamstrings'], 'custom', true),
('Squat', 'strength', 'barbell', array['quads','glutes'], array['hamstrings','lower_back'], 'custom', true),
('Sissy Squat', 'strength', 'body_weight', array['quads'], array[]::text[], 'custom', true),
('Seated Leg Curl', 'strength', 'machine', array['hamstrings'], array[]::text[], 'custom', true),
-- ADDITIONAL COMMON
('Romanian Deadlift', 'strength', 'barbell', array['hamstrings','glutes'], array['lower_back'], 'custom', false),
('Leg Press', 'strength', 'machine', array['quads','glutes'], array['hamstrings'], 'custom', false),
('Calf Raises', 'strength', 'machine', array['calves'], array[]::text[], 'custom', false),
('Face Pulls', 'strength', 'cable', array['rear_delts','rotator_cuff'], array['traps'], 'custom', false),
('Barbell Row', 'strength', 'barbell', array['lats','rhomboids'], array['biceps','rear_delts'], 'custom', false),
('Preacher Curl', 'strength', 'barbell', array['biceps'], array[]::text[], 'custom', false),
('Incline Curl', 'strength', 'dumbbell', array['biceps'], array[]::text[], 'custom', false)

on conflict do nothing;

-- ============================================
-- NOTE: full free-exercise-db (~870 exercises)
-- Run supabase/exercises_seed.sql in the Supabase SQL editor to import the
-- complete database. Regenerate it any time with:
--   node scripts/gen-exercises-seed.mjs
-- ============================================
