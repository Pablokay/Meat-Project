import PasswordManager from '../../components/PasswordManager';

export default function PasswordSection() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Password</h1>
      <PasswordManager onPasswordChange={() => {}} />
    </div>
  );
}
