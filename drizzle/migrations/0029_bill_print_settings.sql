ALTER TABLE public.settings
 ADD COLUMN print_logo text CHECK (print_logo IS NULL OR (print_logo LIKE 'data:image/%' AND length(print_logo)<=400000)),
 ADD COLUMN print_paper text NOT NULL DEFAULT '80mm' CHECK (print_paper IN ('58mm','80mm','A5','A4')),
 ADD COLUMN print_header text NOT NULL DEFAULT '' CHECK (length(print_header)<=200),
 ADD COLUMN print_footer text NOT NULL DEFAULT 'Thank you for your purchase.' CHECK (length(print_footer)<=300),
 ADD COLUMN print_show_address boolean NOT NULL DEFAULT true,
 ADD COLUMN print_show_phone boolean NOT NULL DEFAULT true,
 ADD COLUMN print_show_customer_phone boolean NOT NULL DEFAULT true;