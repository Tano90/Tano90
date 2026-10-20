import MenuPage from "../[id]/page";

export default function NewMenuPage() {
  return <MenuPage params={Promise.resolve({ id: "new" })} searchParams={Promise.resolve({})} />;
}
