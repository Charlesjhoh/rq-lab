import CheckoutForm from '@/components/CheckoutForm';

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <CheckoutForm originalPrice={100} />
    </div>
  );
}