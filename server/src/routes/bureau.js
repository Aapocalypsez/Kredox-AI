import { Router } from 'express';
import { pool } from '../db/pool.js';

export const bureauRouter = Router();

bureauRouter.get('/:customer_id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, declared_age, bureau_score, existing_loans, loan_amount_requested, declared_monthly_income
       FROM customers
       WHERE id = $1`,
      [req.params.customer_id]
    );

    if (!result.rowCount) {
      const error = new Error('Customer bureau profile not found');
      error.statusCode = 404;
      error.publicMessage = 'Customer bureau profile not found';
      throw error;
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});
