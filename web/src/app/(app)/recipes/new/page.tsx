import RecipePage from "../[id]/page";

export default function NewRecipePage() {
  return <RecipePage params={Promise.resolve({ id: "new" })} />;
}
