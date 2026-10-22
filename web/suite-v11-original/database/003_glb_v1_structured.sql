-- GLB AI Suite v1.0 RC1: ADDITIVE MIGRATION FOR THE EXISTING v0.8 SCHEMA.
-- Prerequisite: public.glb_memberships from 001_cloud_pilot.sql and 002_roles_and_security.sql.
-- Run in a STAGING project, test all 7+ roles, and back up production before rollout.
-- No DROP TABLE / destructive changes to v0.8 structures. Existing JSON data is NOT auto-migrated.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;

-- This function is not exposed through the Supabase Data API. It is called only by RLS policies.
CREATE OR REPLACE FUNCTION private.glb_v1_has_role(p_org uuid, p_allowed text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.glb_memberships m
    WHERE m.organization_id = p_org
      AND m.user_id = (SELECT auth.uid())
      AND m.role = ANY(p_allowed)
  );
$$;
REVOKE ALL ON FUNCTION private.glb_v1_has_role(uuid,text[]) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.glb_v1_has_role(uuid,text[]) TO authenticated;

CREATE TABLE IF NOT EXISTS public.glb_v1_outlets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.glb_organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  UNIQUE(organization_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS glb_v1_outlets_org_name_idx ON public.glb_v1_outlets(organization_id,lower(name));

CREATE TABLE IF NOT EXISTS public.glb_v1_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.glb_organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  unit_cost_net numeric(14,4) CHECK (unit_cost_net >= 0),
  vat_percent numeric(5,2) NOT NULL DEFAULT 7 CHECK (vat_percent IN (7,19)),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  UNIQUE(organization_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS glb_v1_products_org_name_idx ON public.glb_v1_products(organization_id,lower(name));

CREATE TABLE IF NOT EXISTS public.glb_v1_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.glb_organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  outlet_id uuid NOT NULL,
  month date NOT NULL CHECK (month = date_trunc('month',month)::date),
  quantity numeric(16,3) NOT NULL CHECK (quantity >= 0 AND quantity <= 100000000),
  unit_price_gross numeric(14,4) NOT NULL CHECK (unit_price_gross >= 0),
  unit_cost_net numeric(14,4) CHECK (unit_cost_net >= 0),
  vat_percent numeric(5,2) NOT NULL CHECK (vat_percent IN (7,19)),
  source_hash text NOT NULL CHECK (source_hash ~ '^[a-f0-9]{64}$'),
  line_no integer NOT NULL CHECK (line_no >= 2),
  file_name text NOT NULL DEFAULT 'Import.csv' CHECK (length(file_name) BETWEEN 1 AND 250),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  FOREIGN KEY (organization_id, product_id) REFERENCES public.glb_v1_products(organization_id,id),
  FOREIGN KEY (organization_id, outlet_id) REFERENCES public.glb_v1_outlets(organization_id,id),
  UNIQUE (organization_id,source_hash,line_no)
);
CREATE INDEX IF NOT EXISTS glb_v1_sales_org_month_idx ON public.glb_v1_sales(organization_id,month DESC);
CREATE INDEX IF NOT EXISTS glb_v1_sales_org_product_idx ON public.glb_v1_sales(organization_id,product_id);
CREATE INDEX IF NOT EXISTS glb_v1_sales_org_outlet_idx ON public.glb_v1_sales(organization_id,outlet_id);

CREATE TABLE IF NOT EXISTS public.glb_v1_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.glb_organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  unit text NOT NULL DEFAULT 'Stück' CHECK(length(trim(unit)) BETWEEN 1 AND 32),
  stock numeric(16,3) NOT NULL DEFAULT 0 CHECK (stock >= 0),
  reorder_point numeric(16,3) NOT NULL DEFAULT 0 CHECK (reorder_point >= 0),
  par_level numeric(16,3) NOT NULL DEFAULT 0 CHECK (par_level >= reorder_point),
  supplier text NOT NULL DEFAULT '' CHECK(length(supplier) <= 120),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  UNIQUE(organization_id,id)
);
CREATE INDEX IF NOT EXISTS glb_v1_inventory_org_idx ON public.glb_v1_inventory(organization_id);

CREATE TABLE IF NOT EXISTS public.glb_v1_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.glb_organizations(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 250),
  priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal','medium','high')),
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','done')),
  due_on date,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  UNIQUE(organization_id,id)
);
CREATE INDEX IF NOT EXISTS glb_v1_tasks_org_status_idx ON public.glb_v1_tasks(organization_id,status,due_on);

CREATE TABLE IF NOT EXISTS public.glb_v1_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.glb_organizations(id) ON DELETE CASCADE,
  entity text NOT NULL,
  entity_id uuid,
  operation text NOT NULL,
  actor uuid DEFAULT auth.uid(),
  happened_at timestamptz NOT NULL DEFAULT now(),
  old_data jsonb,
  new_data jsonb
);
CREATE INDEX IF NOT EXISTS glb_v1_audit_org_date_idx ON public.glb_v1_audit_events(organization_id,happened_at DESC);

CREATE OR REPLACE FUNCTION private.glb_v1_audit_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_org uuid; v_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN v_org := OLD.organization_id; v_id := OLD.id;
  ELSE v_org := NEW.organization_id; v_id := NEW.id; END IF;
  INSERT INTO public.glb_v1_audit_events(organization_id,entity,entity_id,operation,actor,old_data,new_data)
  VALUES (v_org,TG_TABLE_NAME,v_id,TG_OP,(SELECT auth.uid()),
         CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
         CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.glb_v1_audit_trigger() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['glb_v1_outlets','glb_v1_products','glb_v1_sales','glb_v1_inventory','glb_v1_tasks'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS glb_v1_audit ON public.%I',t);
    EXECUTE format('CREATE TRIGGER glb_v1_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.glb_v1_audit_trigger()',t);
  END LOOP;
END $$;

-- Compare-and-swap clients send expected version and version+1; reject invalid bumps.
CREATE OR REPLACE FUNCTION private.glb_v1_check_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'INVALID_VERSION_INCREMENT';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.glb_v1_check_version() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS glb_v1_inventory_version ON public.glb_v1_inventory;
CREATE TRIGGER glb_v1_inventory_version BEFORE UPDATE ON public.glb_v1_inventory
  FOR EACH ROW EXECUTE FUNCTION private.glb_v1_check_version();
DROP TRIGGER IF EXISTS glb_v1_tasks_version ON public.glb_v1_tasks;
CREATE TRIGGER glb_v1_tasks_version BEFORE UPDATE ON public.glb_v1_tasks
  FOR EACH ROW EXECUTE FUNCTION private.glb_v1_check_version();

-- RLS on all newly exposed tables. Privileges and policies must BOTH authorize an operation.
ALTER TABLE public.glb_v1_outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glb_v1_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glb_v1_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glb_v1_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glb_v1_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glb_v1_audit_events ENABLE ROW LEVEL SECURITY;

-- Be explicit: no public/anon table privileges; only required grants to authenticated.
REVOKE ALL ON public.glb_v1_outlets,public.glb_v1_products,public.glb_v1_sales,
  public.glb_v1_inventory,public.glb_v1_tasks,public.glb_v1_audit_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.glb_v1_outlets,public.glb_v1_products,public.glb_v1_sales,
  public.glb_v1_inventory,public.glb_v1_tasks,public.glb_v1_audit_events TO authenticated;
GRANT INSERT(organization_id,name) ON public.glb_v1_outlets TO authenticated;
GRANT UPDATE(name) ON public.glb_v1_outlets TO authenticated;
GRANT INSERT(organization_id,name,unit_cost_net,vat_percent) ON public.glb_v1_products TO authenticated;
GRANT UPDATE(name,unit_cost_net,vat_percent) ON public.glb_v1_products TO authenticated;
GRANT INSERT(organization_id,product_id,outlet_id,month,quantity,unit_price_gross,
  unit_cost_net,vat_percent,source_hash,line_no,file_name) ON public.glb_v1_sales TO authenticated;
GRANT INSERT(organization_id,name,unit,stock,reorder_point,par_level,supplier) ON public.glb_v1_inventory TO authenticated;
GRANT UPDATE(stock,version) ON public.glb_v1_inventory TO authenticated;
GRANT INSERT(organization_id,title,priority,status,due_on) ON public.glb_v1_tasks TO authenticated;
GRANT UPDATE(status,version) ON public.glb_v1_tasks TO authenticated;

DROP POLICY IF EXISTS v1_outlets_read ON public.glb_v1_outlets;
CREATE POLICY v1_outlets_read ON public.glb_v1_outlets FOR SELECT TO authenticated USING (
  private.glb_v1_has_role(organization_id,ARRAY['owner','editor','viewer','service_staff','kitchen_staff','sales','service_lead','kitchen_lead','restaurant_manager','general_manager']));
DROP POLICY IF EXISTS v1_outlets_write ON public.glb_v1_outlets;
CREATE POLICY v1_outlets_write ON public.glb_v1_outlets FOR INSERT TO authenticated WITH CHECK (
  private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager']));
DROP POLICY IF EXISTS v1_outlets_update ON public.glb_v1_outlets;
CREATE POLICY v1_outlets_update ON public.glb_v1_outlets FOR UPDATE TO authenticated USING (
  private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager'])) WITH CHECK (
  private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager']));

DROP POLICY IF EXISTS v1_products_read ON public.glb_v1_products;
CREATE POLICY v1_products_read ON public.glb_v1_products FOR SELECT TO authenticated USING (
  private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager']));
DROP POLICY IF EXISTS v1_products_write ON public.glb_v1_products;
CREATE POLICY v1_products_write ON public.glb_v1_products FOR INSERT TO authenticated WITH CHECK (
  private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager']));
DROP POLICY IF EXISTS v1_products_update ON public.glb_v1_products;
CREATE POLICY v1_products_update ON public.glb_v1_products FOR UPDATE TO authenticated USING (
  private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager'])) WITH CHECK (
  private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager']));

DROP POLICY IF EXISTS v1_sales_read ON public.glb_v1_sales;
CREATE POLICY v1_sales_read ON public.glb_v1_sales FOR SELECT TO authenticated USING (
  private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager']));
DROP POLICY IF EXISTS v1_sales_insert ON public.glb_v1_sales;
CREATE POLICY v1_sales_insert ON public.glb_v1_sales FOR INSERT TO authenticated WITH CHECK (
  private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager']));
-- Sales facts are immutable. Only a NULL historical cost may be explicitly completed.
GRANT UPDATE(unit_cost_net) ON public.glb_v1_sales TO authenticated;
DROP POLICY IF EXISTS v1_sales_backfill ON public.glb_v1_sales;
CREATE POLICY v1_sales_backfill ON public.glb_v1_sales FOR UPDATE TO authenticated USING (
  private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager'])) WITH CHECK (
  private.glb_v1_has_role(organization_id,ARRAY['owner','editor','restaurant_manager','general_manager']));
CREATE OR REPLACE FUNCTION private.glb_v1_cost_only_trigger() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.unit_cost_net IS NOT NULL OR NEW.unit_cost_net IS NULL
      OR to_jsonb(NEW)-'unit_cost_net' IS DISTINCT FROM to_jsonb(OLD)-'unit_cost_net' THEN
    RAISE EXCEPTION 'ONLY_MISSING_COST_CAN_BE_BACKFILLED';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.glb_v1_cost_only_trigger() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS glb_v1_sales_cost_only ON public.glb_v1_sales;
CREATE TRIGGER glb_v1_sales_cost_only BEFORE UPDATE ON public.glb_v1_sales
  FOR EACH ROW EXECUTE FUNCTION private.glb_v1_cost_only_trigger();
-- No DELETE grant/policy for sales. Existing prices/quantities and set costs are immutable.

DROP POLICY IF EXISTS v1_inventory_read ON public.glb_v1_inventory;
CREATE POLICY v1_inventory_read ON public.glb_v1_inventory FOR SELECT TO authenticated USING (
  private.glb_v1_has_role(organization_id,ARRAY['owner','editor','kitchen_staff','kitchen_lead','restaurant_manager','general_manager']));
DROP POLICY IF EXISTS v1_inventory_write ON public.glb_v1_inventory;
CREATE POLICY v1_inventory_write ON public.glb_v1_inventory FOR INSERT TO authenticated WITH CHECK (
  private.glb_v1_has_role(organization_id,ARRAY['owner','editor','kitchen_lead','restaurant_manager','general_manager']));
DROP POLICY IF EXISTS v1_inventory_update ON public.glb_v1_inventory;
CREATE POLICY v1_inventory_update ON public.glb_v1_inventory FOR UPDATE TO authenticated USING (
  private.glb_v1_has_role(organization_id,ARRAY['owner','editor','kitchen_lead','restaurant_manager','general_manager'])) WITH CHECK (
  private.glb_v1_has_role(organization_id,ARRAY['owner','editor','kitchen_lead','restaurant_manager','general_manager']));

DROP POLICY IF EXISTS v1_tasks_read ON public.glb_v1_tasks;
CREATE POLICY v1_tasks_read ON public.glb_v1_tasks FOR SELECT TO authenticated USING (
  private.glb_v1_has_role(organization_id,ARRAY['owner','editor','viewer','service_staff','kitchen_staff','sales','service_lead','kitchen_lead','restaurant_manager','general_manager']));
DROP POLICY IF EXISTS v1_tasks_write ON public.glb_v1_tasks;
CREATE POLICY v1_tasks_write ON public.glb_v1_tasks FOR INSERT TO authenticated WITH CHECK (
  private.glb_v1_has_role(organization_id,ARRAY['owner','editor','service_staff','kitchen_staff','sales','service_lead','kitchen_lead','restaurant_manager','general_manager']));
DROP POLICY IF EXISTS v1_tasks_update ON public.glb_v1_tasks;
CREATE POLICY v1_tasks_update ON public.glb_v1_tasks FOR UPDATE TO authenticated USING (
  private.glb_v1_has_role(organization_id,ARRAY['owner','editor','service_staff','kitchen_staff','sales','service_lead','kitchen_lead','restaurant_manager','general_manager'])) WITH CHECK (
  private.glb_v1_has_role(organization_id,ARRAY['owner','editor','service_staff','kitchen_staff','sales','service_lead','kitchen_lead','restaurant_manager','general_manager']));

DROP POLICY IF EXISTS v1_audit_read ON public.glb_v1_audit_events;
CREATE POLICY v1_audit_read ON public.glb_v1_audit_events FOR SELECT TO authenticated USING (
  private.glb_v1_has_role(organization_id,ARRAY['owner','general_manager']));

COMMIT;
