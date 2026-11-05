import { itemRoutes } from '../../../../../lib/company/customers/http';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export const {GET,PATCH}=itemRoutes('publicCustomers');
