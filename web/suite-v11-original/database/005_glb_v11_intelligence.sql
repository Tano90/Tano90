-- GLB AI Suite v1.1 RC1. Additiv nach 003_glb_v1_structured.sql.
-- Vor der Ausführung Backup und Staging-Test. v0.8 Tabellen werden NICHT verändert.
BEGIN;
-- Lightweight authenticated role check for the AI Worker; does not expose workspace data.
CREATE OR REPLACE FUNCTION public.glb_v11_can_manage(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.glb_v1_has_role(p_org,ARRAY['owner','editor','restaurant_manager','general_manager']);
$$;
REVOKE ALL ON FUNCTION public.glb_v11_can_manage(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.glb_v11_can_manage(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.glb_v11_pos_lines(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.glb_organizations(id) ON DELETE CASCADE,
 service_date date NOT NULL,
 check_id text NOT NULL CHECK(length(check_id) BETWEEN 1 AND 100),
 outlet_id uuid NOT NULL,
 product_id uuid,
 product_name text NOT NULL CHECK(length(product_name) BETWEEN 1 AND 200),
 quantity numeric(16,3) NOT NULL CHECK(quantity > 0 AND quantity<=10000000),
 unit_price_gross numeric(14,4) NOT NULL CHECK(unit_price_gross>=0),
 unit_cost_net numeric(14,4) CHECK(unit_cost_net>=0),
 vat_percent numeric(5,2) NOT NULL CHECK(vat_percent IN(7,19)),
 guests integer CHECK(guests BETWEEN 1 AND 1000),
 stage text NOT NULL DEFAULT 'none' CHECK(stage IN('none','aperitif','water','upgrade','dessert','coffee','afterglow')),
 staff_code text NOT NULL DEFAULT '' CHECK(length(staff_code)<=80),
 source_system text NOT NULL DEFAULT 'csv' CHECK(length(source_system) BETWEEN 1 AND 64),
 external_line_id text CHECK(length(external_line_id) BETWEEN 1 AND 200),
 source_hash text NOT NULL CHECK(source_hash ~ '^[a-f0-9]{64}$'),
 line_no integer NOT NULL CHECK(line_no>=2),
 file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 250),
 created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid DEFAULT auth.uid(),
 FOREIGN KEY(organization_id,outlet_id) REFERENCES public.glb_v1_outlets(organization_id,id),
 FOREIGN KEY(organization_id,product_id) REFERENCES public.glb_v1_products(organization_id,id),
 UNIQUE(organization_id,source_hash,line_no)
);
CREATE UNIQUE INDEX IF NOT EXISTS glb_v11_pos_external_id ON public.glb_v11_pos_lines(organization_id,source_system,external_line_id);
CREATE INDEX IF NOT EXISTS glb_v11_pos_date ON public.glb_v11_pos_lines(organization_id,service_date DESC,outlet_id);
CREATE INDEX IF NOT EXISTS glb_v11_pos_bon ON public.glb_v11_pos_lines(organization_id,service_date,outlet_id,check_id);

CREATE TABLE IF NOT EXISTS public.glb_v11_product_tags(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.glb_organizations(id) ON DELETE CASCADE,
 product_name text NOT NULL CHECK(length(trim(product_name)) BETWEEN 1 AND 200),
 stage text NOT NULL CHECK(stage IN('none','aperitif','water','upgrade','dessert','coffee','afterglow')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,product_name)
);
CREATE TABLE IF NOT EXISTS public.glb_v11_targets(
 organization_id uuid NOT NULL REFERENCES public.glb_organizations(id) ON DELETE CASCADE,
 stage text NOT NULL CHECK(stage IN('aperitif','water','upgrade','dessert','coffee','afterglow')),
 target_ratio numeric(5,4) NOT NULL CHECK(target_ratio BETWEEN 0 AND 1),
 PRIMARY KEY(organization_id,stage)
);
CREATE TABLE IF NOT EXISTS public.glb_v11_market_observations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.glb_organizations(id) ON DELETE CASCADE,
 competitor_name text NOT NULL CHECK(length(trim(competitor_name)) BETWEEN 1 AND 160),
 own_product text NOT NULL CHECK(length(trim(own_product)) BETWEEN 1 AND 200),
 competitor_product text NOT NULL CHECK(length(trim(competitor_product)) BETWEEN 1 AND 200),
 competitor_price_gross numeric(14,4) NOT NULL CHECK(competitor_price_gross>0),
 our_price_gross numeric(14,4) NOT NULL CHECK(our_price_gross>0),
 source_url text NOT NULL CHECK(length(source_url) BETWEEN 10 AND 1000 AND source_url ~ '^https://'),
 checked_on date NOT NULL,
 note text NOT NULL DEFAULT '' CHECK(length(note)<=1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid DEFAULT auth.uid()
);
CREATE INDEX IF NOT EXISTS glb_v11_market_org_date ON public.glb_v11_market_observations(organization_id,checked_on DESC);
CREATE TABLE IF NOT EXISTS public.glb_v11_training_results(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.glb_organizations(id) ON DELETE CASCADE,
 user_id uuid NOT NULL DEFAULT auth.uid(),
 stage text NOT NULL CHECK(stage IN('aperitif','water','upgrade','dessert','coffee','afterglow')),
 correct boolean NOT NULL,
 points integer NOT NULL CHECK(points IN(0,100)),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((correct AND points=100) OR (NOT correct AND points=0))
);
CREATE INDEX IF NOT EXISTS glb_v11_training_org_user ON public.glb_v11_training_results(organization_id,user_id,created_at DESC);

ALTER TABLE public.glb_v11_pos_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glb_v11_product_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glb_v11_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glb_v11_market_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glb_v11_training_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.glb_v11_pos_lines,public.glb_v11_product_tags,public.glb_v11_targets,
 public.glb_v11_market_observations,public.glb_v11_training_results FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.glb_v11_pos_lines,public.glb_v11_product_tags,public.glb_v11_targets,
 public.glb_v11_market_observations TO authenticated;
GRANT SELECT ON public.glb_v11_training_results TO authenticated;
GRANT INSERT(organization_id,service_date,check_id,outlet_id,product_id,product_name,quantity,
 unit_price_gross,unit_cost_net,vat_percent,guests,stage,staff_code,source_hash,line_no,file_name)
 ON public.glb_v11_pos_lines TO authenticated;
GRANT INSERT(organization_id,product_name,stage) ON public.glb_v11_product_tags TO authenticated;
GRANT UPDATE(stage) ON public.glb_v11_product_tags TO authenticated;
GRANT INSERT(organization_id,stage,target_ratio) ON public.glb_v11_targets TO authenticated;
GRANT UPDATE(target_ratio) ON public.glb_v11_targets TO authenticated;
GRANT INSERT(organization_id,competitor_name,own_product,competitor_product,competitor_price_gross,
 our_price_gross,source_url,checked_on,note) ON public.glb_v11_market_observations TO authenticated;
GRANT INSERT(organization_id,user_id,stage,correct,points) ON public.glb_v11_training_results TO authenticated;
-- Immutable facts: no UPDATE/DELETE grants for POS, market observations or training.

CREATE POLICY v11_pos_read ON public.glb_v11_pos_lines FOR SELECT TO authenticated USING(
 private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager']));
CREATE POLICY v11_pos_write ON public.glb_v11_pos_lines FOR INSERT TO authenticated WITH CHECK(
 private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager']));
CREATE POLICY v11_tag_read ON public.glb_v11_product_tags FOR SELECT TO authenticated USING(
 private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager']));
CREATE POLICY v11_tag_write ON public.glb_v11_product_tags FOR INSERT TO authenticated WITH CHECK(
 private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager']));
CREATE POLICY v11_tag_update ON public.glb_v11_product_tags FOR UPDATE TO authenticated USING(
 private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager'])) WITH CHECK(
 private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager']));
CREATE POLICY v11_target_read ON public.glb_v11_targets FOR SELECT TO authenticated USING(
 private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager']));
CREATE POLICY v11_target_write ON public.glb_v11_targets FOR INSERT TO authenticated WITH CHECK(
 private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager']));
CREATE POLICY v11_target_update ON public.glb_v11_targets FOR UPDATE TO authenticated USING(
 private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager'])) WITH CHECK(
 private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager']));
CREATE POLICY v11_market_read ON public.glb_v11_market_observations FOR SELECT TO authenticated USING(
 private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager']));
CREATE POLICY v11_market_write ON public.glb_v11_market_observations FOR INSERT TO authenticated WITH CHECK(
 private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager']));
CREATE POLICY v11_training_read ON public.glb_v11_training_results FOR SELECT TO authenticated USING(
 user_id=(SELECT auth.uid()) AND private.glb_v1_has_role(organization_id,
 ARRAY['owner','editor','service_staff','kitchen_staff','sales','service_lead','kitchen_lead','restaurant_manager','general_manager']));
CREATE POLICY v11_training_write ON public.glb_v11_training_results FOR INSERT TO authenticated WITH CHECK(
 user_id=(SELECT auth.uid()) AND private.glb_v1_has_role(organization_id,
 ARRAY['owner','editor','service_staff','kitchen_staff','sales','service_lead','kitchen_lead','restaurant_manager','general_manager']));
-- Stronger server-side restraint: one stored quiz attempt per lesson per user per day.
CREATE UNIQUE INDEX IF NOT EXISTS glb_v11_training_daily_unique ON public.glb_v11_training_results(organization_id,user_id,stage,((created_at AT TIME ZONE 'UTC')::date));
-- Audit for added datasets using v1 security definer function. No alteration of v0.8 triggers.
DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['glb_v11_pos_lines','glb_v11_product_tags','glb_v11_market_observations','glb_v11_training_results'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS glb_v1_audit ON public.%I',t);
  EXECUTE format('CREATE TRIGGER glb_v1_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.glb_v1_audit_trigger()',t);
 END LOOP;
END $$;
COMMIT;
