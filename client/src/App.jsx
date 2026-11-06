import { Route, Routes } from 'react-router-dom';
import { GuestOnly, RequireAdmin, RequireAuth, RequireMember } from './components/Guards.jsx';
import Layout from './components/Layout.jsx';
import AdminAudit from './pages/admin/AdminAudit.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminListings from './pages/admin/AdminListings.jsx';
import AdminReports from './pages/admin/AdminReports.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import { ForgotPassword, GoogleSignup, Login, Register, ResetPassword } from './pages/AuthPages.jsx';
import BookDetails from './pages/BookDetails.jsx';
import Browse from './pages/Browse.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Landing from './pages/Landing.jsx';
import { CreateListing, EditListing } from './pages/ListingForm.jsx';
import Messages from './pages/Messages.jsx';
import MyListings from './pages/MyListings.jsx';
import NotFound from './pages/NotFound.jsx';
import Notifications from './pages/Notifications.jsx';
import { PublicProfile, EditProfile } from './pages/Profile.jsx';
import { PurchaseRequests, Transactions } from './pages/Requests.jsx';
import Wishlist from './pages/Wishlist.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="books" element={<Browse />} />
        <Route path="books/:id" element={<BookDetails />} />
        <Route path="users/:id" element={<PublicProfile />} />

        <Route element={<GuestOnly />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="register/google" element={<GoogleSignup />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password/:token" element={<ResetPassword />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route path="profile" element={<EditProfile />} />
          <Route path="notifications" element={<Notifications />} />
          <Route element={<RequireMember />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="sell" element={<CreateListing />} />
            <Route path="my-listings" element={<MyListings />} />
            <Route path="my-listings/:id/edit" element={<EditListing />} />
            <Route path="wishlist" element={<Wishlist />} />
            <Route path="requests" element={<PurchaseRequests />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="messages" element={<Messages />} />
            <Route path="messages/:id" element={<Messages />} />
          </Route>
        </Route>

        <Route path="admin" element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="listings" element={<AdminListings />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="audit" element={<AdminAudit />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
