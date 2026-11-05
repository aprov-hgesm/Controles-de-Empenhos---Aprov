import { collectionRoutes } from '../../../../lib/company/customers/http';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export const {GET,POST}=collectionRoutes('customerOrders');
