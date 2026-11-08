-- FAMILY (the old single paid plan) becomes PREMIUM; BASIC is new.
ALTER TYPE "Plan" RENAME VALUE 'FAMILY' TO 'PREMIUM';
ALTER TYPE "Plan" ADD VALUE 'BASIC';
