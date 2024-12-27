import ContactInfo from './ui/ContactInfo'
import { Facebook, Instagram, Phone } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <ContactInfo />
        </div>
        
        <div>
          <h3 className="font-semibold text-lg mb-4">Redes Sociais</h3>
          <div className="space-y-2">
            <a href="#" className="flex items-center gap-2 text-gray-600 hover:text-primary">
              <Instagram size={20} />
              <span>Instagram</span>
            </a>
            <a href="#" className="flex items-center gap-2 text-gray-600 hover:text-primary">
              <Facebook size={20} />
              <span>Facebook</span>
            </a>
          </div>
        </div>
        
        <div>
          <h3 className="font-semibold text-lg mb-4">Contato</h3>
          <a href="tel:+5544999999999" className="flex items-center gap-2 text-gray-600 hover:text-primary">
            <Phone size={20} />
            <span>(44) 99999-9999</span>
          </a>
        </div>
      </div>
      
      <div className="border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-600">
          © {new Date().getFullYear()} Mega Celulares. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  )
}