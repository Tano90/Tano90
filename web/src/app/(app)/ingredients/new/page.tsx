import IngredientPage from "../[id]/page";

export default function NewIngredientPage() {
  return <IngredientPage params={Promise.resolve({ id: "new" })} searchParams={Promise.resolve({})} />;
}
