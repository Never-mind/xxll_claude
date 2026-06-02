import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { DatabaseStorageService } from '../server/common/database-storage.service.js';
import { CustomerService } from '../server/modules/customer/customer.service.js';
import { HistoryQuotationService } from '../server/modules/history-quotation/history-quotation.service.js';
import { ProductService } from '../server/modules/product/product.service.js';
import { QuotationService } from '../server/modules/quotation/quotation.service.js';
import { TariffRateService } from '../server/modules/tariff-rate/tariff-rate.service.js';

const upload = multer({ storage: multer.memoryStorage() });
const app = createServer();

export default async function handler(request: any, response: any) {
  return app(request, response);
}

function createServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const storage = new DatabaseStorageService();
  const products = new ProductService(storage);
  const customers = new CustomerService(storage);
  const tariffs = new TariffRateService(storage);
  const history = new HistoryQuotationService(storage, products);
  const quotations = new QuotationService(storage, products, customers, tariffs, history);

  const writeAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = process.env.WRITE_AUTH_TOKEN;
    if (!token || req.header('x-auth-token') === token) return next();
    return res.status(401).json({ message: 'Missing or invalid write token' });
  };

  app.get('/api/products', wrap((req) => products.list(String(req.query.keyword || ''), num(req.query.page), num(req.query.pageSize))));
  app.post('/api/products', writeAuth, wrap((req) => products.create(req.body)));
  app.put('/api/products/:id', writeAuth, wrap((req) => products.update(param(req, 'id'), req.body)));
  app.delete('/api/products/:id', writeAuth, wrap((req) => products.remove(param(req, 'id'))));
  app.get('/api/products/export', download('products.xlsx', () => products.export()));
  app.post('/api/products/import', writeAuth, upload.single('file'), wrap((req) => products.import(req.file!.buffer)));

  app.get('/api/customers', wrap((req) => customers.list(String(req.query.keyword || ''), num(req.query.page), num(req.query.pageSize))));
  app.post('/api/customers', writeAuth, wrap((req) => customers.create(req.body)));
  app.put('/api/customers/:id', writeAuth, wrap((req) => customers.update(param(req, 'id'), req.body)));
  app.delete('/api/customers/:id', writeAuth, wrap((req) => customers.remove(param(req, 'id'))));
  app.get('/api/customers/export', download('customers.xlsx', () => customers.export()));
  app.post('/api/customers/import', writeAuth, upload.single('file'), wrap((req) => customers.import(req.file!.buffer)));

  app.get('/api/tariff-rates', wrap((req) => tariffs.list(String(req.query.keyword || ''), num(req.query.page), num(req.query.pageSize))));
  app.get('/api/tariff-rates/by-hs-code', wrap((req) => tariffs.byHsCode(String(req.query.hsCode || ''))));
  app.post('/api/tariff-rates', writeAuth, wrap((req) => tariffs.create(req.body)));
  app.put('/api/tariff-rates/:id', writeAuth, wrap((req) => tariffs.update(param(req, 'id'), req.body)));
  app.delete('/api/tariff-rates/:id', writeAuth, wrap((req) => tariffs.remove(param(req, 'id'))));
  app.get('/api/tariff-rates/export', download('tariff_rates.xlsx', () => tariffs.export()));
  app.post('/api/tariff-rates/import', writeAuth, upload.single('file'), wrap((req) => tariffs.import(req.file!.buffer)));

  app.get('/api/history-quotations', wrap((req) => history.list(String(req.query.keyword || ''), num(req.query.page), num(req.query.pageSize))));
  app.post('/api/history-quotations', writeAuth, wrap((req) => history.create(req.body)));
  app.put('/api/history-quotations/:id', writeAuth, wrap((req) => history.update(param(req, 'id'), req.body)));
  app.delete('/api/history-quotations/:id', writeAuth, wrap((req) => history.remove(param(req, 'id'))));
  app.get('/api/history-quotations/export', download('history_quotations.xlsx', () => history.export()));
  app.post('/api/history-quotations/import', writeAuth, upload.single('file'), wrap((req) => history.import(req.file!.buffer)));

  app.get('/api/quotations', wrap((req) => quotations.list(num(req.query.page), num(req.query.pageSize), req.query.status ? String(req.query.status) : undefined)));
  app.get('/api/quotations/export', download('quotations.xlsx', (req) => quotations.exportList(req.query.status ? String(req.query.status) : undefined)));
  app.post('/api/quotations', writeAuth, wrap((req) => quotations.create(req.body)));
  app.put('/api/quotations/:id', writeAuth, wrap((req) => quotations.update(param(req, 'id'), req.body)));
  app.get('/api/quotations/:id', wrap((req) => quotations.detail(param(req, 'id'))));
  app.get('/api/quotations/:id/items', wrap((req) => quotations.items(param(req, 'id'), num(req.query.page), num(req.query.pageSize))));
  app.get('/api/quotations/:id/items-for-edit', wrap((req) => quotations.itemsForEdit(param(req, 'id'))));
  app.get('/api/quotations/:id/export', download('quotation.xlsx', (req) => quotations.export(param(req, 'id'))));
  app.delete('/api/quotations/:id', writeAuth, wrap((req) => quotations.remove(param(req, 'id'))));

  return app;
}

function wrap(action: (req: express.Request) => Promise<unknown>) {
  return async (req: express.Request, res: express.Response) => {
    try {
      const result = await action(req);
      res.json(result ?? {});
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  };
}

function download(fileName: string, action: (req: express.Request) => Promise<Buffer>) {
  return async (req: express.Request, res: express.Response) => {
    try {
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(await action(req));
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  };
}

function num(value: unknown) {
  return Number(value || 0);
}

function param(req: express.Request, key: string) {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] : value;
}
