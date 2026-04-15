import { Link } from '@tanstack/react-router'
import clsx from 'clsx'

const variantStyles = {
  primary:
    'rounded-full bg-teal-300 py-2 px-4 text-sm font-semibold text-zinc-900 hover:bg-teal-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300/50 active:bg-teal-500',
  secondary:
    'rounded-full bg-zinc-800 py-2 px-4 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 active:text-zinc-400',
}

type ButtonProps = {
  variant?: keyof typeof variantStyles
} & (
  | (React.ComponentPropsWithoutRef<typeof Link> & { href: string })
  | (React.ComponentPropsWithoutRef<'button'> & { href?: undefined })
)

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonProps) {
  className = clsx(variantStyles[variant], className)

  return typeof props.href === 'undefined' ? (
    <button className={className} {...props} />
  ) : (
    <Link className={className} {...(props as any)} to={props.href} />
  )
}
