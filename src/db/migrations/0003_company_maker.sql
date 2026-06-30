-- Differentiate the prominent brand/product (companies.name) from the company
-- that makes it. `maker` is null when the company and product are the same.
alter table companies add column maker text;
