import { cx } from '../../lib/format'

export function Card({ children, className, danger = false, ...rest }) {
  return (
    <section className={cx('card', danger && 'danger-zone', className)} {...rest}>
      {children}
    </section>
  )
}

export function CardHead({ title, description, action, children }) {
  return (
    <div className="card-head">
      <div>
        {title ? <h3 className="card-title">{title}</h3> : null}
        {description ? <p className="card-desc">{description}</p> : null}
        {children}
      </div>
      {action ? <div className="row">{action}</div> : null}
    </div>
  )
}

export function CardBody({ children, className }) {
  return <div className={cx('card-body', className)}>{children}</div>
}

export function CardFoot({ children, className }) {
  return <div className={cx('card-foot', className)}>{children}</div>
}

export default Card
