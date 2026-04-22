import { Calendar } from './Calendar'

export function App() {
  const today = new Date()
  return <Calendar year={today.getFullYear()} month={today.getMonth()} />
}
