import BookingCancellation from "../../components/BookingCancellation";
export default async function CancelBookingPage({ searchParams }) { const params = await searchParams; return <BookingCancellation token={params?.token || ""} />; }
