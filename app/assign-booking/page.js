import BookingAssignment from "../../components/BookingAssignment";

export default async function AssignBookingPage({ searchParams }) {
  const params = await searchParams;
  return <BookingAssignment token={params?.token || ""} />;
}
