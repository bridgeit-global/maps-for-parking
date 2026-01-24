import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Maps for Parking
          </h1>
          <p className="text-xl md:text-2xl mb-4 text-blue-100">
            Empowering Mumbaikars to Navigate Parking Rules
          </p>
          <p className="text-lg md:text-xl mb-8 text-blue-50 max-w-3xl mx-auto">
            Stay informed about parking regulations across Mumbai and avoid unnecessary penalties. 
            Find legal parking zones and understand the rules that matter.
          </p>
          <Link
            href="/map"
            className="inline-block bg-white text-blue-700 px-8 py-4 rounded-full font-semibold text-lg hover:bg-blue-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            Explore the Map →
          </Link>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white dark:from-black to-transparent"></div>
      </section>

      {/* Problem Statement Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
              The Parking Challenge in Mumbai
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Navigating parking rules in Mumbai can be confusing and costly
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
              <div className="text-4xl mb-4">🚗</div>
              <h3 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                Confusing Regulations
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Parking rules vary by zone, time, and day. It's hard to know where you can legally park without risking a fine.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                Expensive Penalties
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Unauthorized parking can result in hefty fines, towing charges, and unnecessary stress for citizens.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
              <div className="text-4xl mb-4">📍</div>
              <h3 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                Lack of Information
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                There's no easy way to check parking rules for a specific location before you park your vehicle.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Our Solution Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
              Our Solution
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              An interactive map that makes parking rules accessible to everyone
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-3xl font-semibold mb-6 text-gray-900 dark:text-white">
                Know Before You Park
              </h3>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                Our interactive map shows you parking zones across Mumbai with clear visual indicators. 
                Click on any area to see detailed parking rules, timings, and restrictions.
              </p>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                Whether you're looking for paid parking, free zones, or time-restricted areas, 
                our map helps you make informed decisions and avoid penalties.
              </p>
              <Link
                href="/map"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Try It Now
              </Link>
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 shadow-lg">
              <div className="aspect-video bg-gradient-to-br from-blue-400 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-2xl font-semibold">Interactive Map Preview</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
              Key Features
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <div className="text-3xl mb-4">🗺️</div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                Interactive Map
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Explore Mumbai with an easy-to-use map interface powered by MapLibreGL
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <div className="text-3xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                Zone Information
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Detailed information about parking zones, rules, and restrictions
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <div className="text-3xl mb-4">⏰</div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                Time-Based Rules
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Understand parking timings and restrictions for different times of day
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <div className="text-3xl mb-4">📱</div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                Mobile Friendly
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Access parking information on the go with our responsive design
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
              Making a Difference
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Empowering citizens with knowledge to make better parking decisions
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-5xl font-bold text-blue-600 mb-2">100%</div>
              <p className="text-lg text-gray-600 dark:text-gray-300">Free Access</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                No cost to citizens
              </p>
            </div>
            <div>
              <div className="text-5xl font-bold text-blue-600 mb-2">24/7</div>
              <p className="text-lg text-gray-600 dark:text-gray-300">Available</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Access information anytime
              </p>
            </div>
            <div>
              <div className="text-5xl font-bold text-blue-600 mb-2">Easy</div>
              <p className="text-lg text-gray-600 dark:text-gray-300">To Use</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Simple and intuitive interface
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Explore?
          </h2>
          <p className="text-xl mb-8 text-blue-100">
            Start using our interactive map to find parking zones and understand rules across Mumbai
          </p>
          <Link
            href="/map"
            className="inline-block bg-white text-blue-700 px-10 py-5 rounded-full font-semibold text-xl hover:bg-blue-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            View the Map →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="mb-4">Maps for Parking - Mumbai</p>
          <p className="text-sm text-gray-500">
            Helping Mumbaikars navigate parking rules and avoid unnecessary penalties
          </p>
        </div>
      </footer>
    </div>
  );
}
