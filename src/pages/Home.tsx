import { Phone, Shield, Truck } from 'lucide-react'

export default function Home() {
  return (
    <div>
      <section className="bg-blue-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl font-bold mb-4">Bem-vindo à Mega Celulares</h1>
          <p className="text-xl">Os melhores smartphones e acessórios você encontra aqui!</p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-block p-4 bg-blue-100 rounded-full mb-4">
                <Phone size={32} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Produtos de Qualidade</h3>
              <p className="text-gray-600">Oferecemos apenas produtos originais e de alta qualidade</p>
            </div>

            <div className="text-center">
              <div className="inline-block p-4 bg-blue-100 rounded-full mb-4">
                <Truck size={32} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Entrega Rápida</h3>
              <p className="text-gray-600">Entregamos em toda região de Colorado</p>
            </div>

            <div className="text-center">
              <div className="inline-block p-4 bg-blue-100 rounded-full mb-4">
                <Shield size={32} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Garantia Assegurada</h3>
              <p className="text-gray-600">Todos os produtos com garantia de fábrica</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}