import { Link } from 'react-router-dom'
import { ShoppingCart, Menu } from 'lucide-react'
import { useState } from 'react'

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-xl font-bold">
            Mega Celulares
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link to="/" className="hover:text-blue-600">Home</Link>
            <Link to="/produtos" className="hover:text-blue-600">Produtos</Link>
            <Link to="/contato" className="hover:text-blue-600">Contato</Link>
          </div>

          <button className="p-2 hover:bg-gray-100 rounded-full">
            <ShoppingCart size={24} />
          </button>

          <button 
            className="md:hidden p-2 hover:bg-gray-100 rounded-full"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <Menu size={24} />
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden mt-4 space-y-2">
            <Link to="/" className="block py-2 hover:text-blue-600">Home</Link>
            <Link to="/produtos" className="block py-2 hover:text-blue-600">Produtos</Link>
            <Link to="/contato" className="block py-2 hover:text-blue-600">Contato</Link>
          </div>
        )}
      </div>
    </nav>
  )
}