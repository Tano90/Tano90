import SupplierPage from "../[id]/page";

export default function NewSupplierPage() {
  return <SupplierPage params={Promise.resolve({ id: "new" })} />;
}
